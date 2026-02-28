FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for Docker caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Start the server (matches port 3002 from docker-compose)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3002"]