# Stage 1: Build the React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend source
COPY frontend/package.json frontend/package-lock.json* frontend/pnpm-lock.yaml* ./
RUN npm install

COPY frontend/ ./
# We need to build it. The package.json has a build command `vite build`
RUN npm run build

# Stage 2: Build the FastAPI Backend
FROM python:3.11-slim AS backend

# Install system dependencies (needed for compiling certain python packages like pandas, psycopg2)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Copy backend requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source
COPY backend/ .

# Copy the frontend built assets directly into backend/static
COPY --from=frontend-builder /app/frontend/dist /app/backend/static

# Set environment variables for production
ENV PYTHONUNBUFFERED=1

# Expose the port
EXPOSE 8010

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]
