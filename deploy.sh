#!/bin/bash

# Exit on any error
set -e

echo "=================================="
echo " Starting One-Stop Analytics SaaS "
echo "=================================="

# Check if docker is installed
if ! command -v docker &> /dev/null
then
    echo "Docker is not installed! Please install docker to proceed."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null
then
    echo "Docker Compose is not installed! Please install it to proceed."
    exit 1
fi

echo "Building and pulling containers..."
# Use either new `docker compose` or old `docker-compose`
if docker compose version &> /dev/null; then
    docker compose up --build -d
else
    docker-compose up --build -d
fi

echo ""
echo "✅ Deployment successful. The application is running in the background."
echo "✅ Access the SaaS at: http://localhost:8010"
echo ""
echo "To view logs, run: docker-compose logs -f"
echo "To stop the app, run: docker-compose down"
