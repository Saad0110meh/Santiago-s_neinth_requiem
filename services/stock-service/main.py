import os
import redis
import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
#Allow the Admin Dashboard to ping the health endpoint
app = FastAPI(title="IUT Cafeteria Stock Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cafuser:cafpass@localhost:5432/cafeteria")

redis_client = redis.from_url(REDIS_URL, decode_responses=True)

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

class DeductRequest(BaseModel):
    item_id: int
    quantity: int

# ---------------------------------------------------------
# CORE REQUIREMENT: Concurrency Control & Inventory
# ---------------------------------------------------------
@app.post("/deduct")
def deduct_stock(req: DeductRequest):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Atomic Update: Decrements ONLY if there is enough stock.
        # This prevents race conditions during the Ramadan rush!
        cursor.execute("""
            UPDATE menu_items 
            SET stock_quantity = stock_quantity - %s 
            WHERE id = %s AND stock_quantity >= %s 
            RETURNING stock_quantity, name;
        """, (req.quantity, req.item_id, req.quantity))
        
        updated_row = cursor.fetchone()
        
        if not updated_row:
            conn.rollback()
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Insufficient stock or item not found")
        
        new_stock, item_name = updated_row
        conn.commit()
        cursor.close()
        conn.close()

        # Update Redis Cache so the Gateway knows the new stock level instantly
        redis_client.set(f"stock:{req.item_id}", new_stock)

        return {"message": "Stock deducted successfully", "item": item_name, "remaining_stock": new_stock}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

# ---------------------------------------------------------
# OBSERVABILITY: Health Endpoint
# ---------------------------------------------------------
@app.get("/health")
def health_check():
    try:
        conn = get_db_connection()
        conn.close()
        redis_client.ping()
        return {"status": "healthy", "service": "Stock Service"}
    except Exception as e:
        print(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service Unavailable")