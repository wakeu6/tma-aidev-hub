FROM python:3.12-slim

# Prevent Python from writing .pyc and enable buffer-less stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy TMA service code
COPY tma_service/ ./tma_service/
COPY .env.example ./.env.example

# Set default port
ENV PORT=8000

EXPOSE 8000

# Start FastAPI backend
CMD ["sh", "-c", "python -m uvicorn tma_service.backend.main:app --host 0.0.0.0 --port ${PORT}"]
