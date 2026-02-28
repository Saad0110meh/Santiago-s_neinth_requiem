import os
import jwt
import redis
import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware # NEW IMPORT
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

app = FastAPI(title="IUT Cafeteria Identity Provider")

# NEW: Allow browsers to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"], # Allows all headers
)
# Load environment variables (Passed from docker-compose.yml)
JWT_SECRET = os.getenv("JWT_SECRET", "devsprint-super-secret-2026")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cafuser:cafpass@localhost:5432/cafeteria")

# Connect to Redis for the Rate Limiter
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

class LoginRequest(BaseModel):
    student_id: str

@app.post("/login")
def login(req: LoginRequest):
    student_id = req.student_id

    # ---------------------------------------------------------
    # 1. BONUS CHALLENGE: Rate Limiting (3 attempts / minute)
    # ---------------------------------------------------------
    redis_key = f"login_attempts:{student_id}"
    attempts = redis_client.get(redis_key)
    
    if attempts and int(attempts) >= 3:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Maximum 3 attempts per minute allowed.")
    
    # Increment the attempt counter
    pipe = redis_client.pipeline()
    pipe.incr(redis_key)
    if not attempts:
        pipe.expire(redis_key, 60) # Expires in 60 seconds
    pipe.execute()

    # ---------------------------------------------------------
    # 2. CORE REQUIREMENT: Database Validation
    # ---------------------------------------------------------
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, role FROM users WHERE student_id = %s", (student_id,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

    if not user:
        raise HTTPException(status_code=401, detail="Invalid Student ID")

    # ---------------------------------------------------------
    # 3. CORE REQUIREMENT: Token Handshake
    # ---------------------------------------------------------
    user_id, name, role = user
    payload = {
        "sub": str(user_id),
        "student_id": student_id,
        "name": name,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=2)
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer"}

# ---------------------------------------------------------
# 4. OBSERVABILITY: Health Endpoint
# ---------------------------------------------------------
@app.get("/health")
def health_check():
    try:
        # Verify DB connection
        conn = get_db_connection()
        conn.close()
        # Verify Redis connection
        redis_client.ping()
        return {"status": "healthy", "service": "Identity Provider"}
    except Exception as e:
        print(f"Health check failed: {e}")
        # Return 503 if a dependency is down
        raise HTTPException(status_code=503, detail="Service Unavailable")