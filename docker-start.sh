#!/bin/bash
# Pixelle-Video Docker Quick Start Script

set -e

echo "🐳 Pixelle-Video Docker Deployment"
echo "=================================="
echo ""

# Check if config.yaml exists as a directory (Docker mount issue)
if [ -d config.yaml ]; then
    echo "⚠️  config.yaml is a directory (Docker mount issue), removing it..."
    rm -rf config.yaml
fi

# Check if config.yaml exists, if not, create from example
if [ ! -f config.yaml ]; then
    echo "⚠️  config.yaml not found, creating from config.example.yaml..."
    if [ -f config.example.yaml ]; then
        cp config.example.yaml config.yaml
        echo "✅ config.yaml created successfully!"
        echo ""
        echo "⚠️  IMPORTANT: Please edit config.yaml and fill in:"
        echo "   - LLM API key and settings"
        echo "   - ComfyUI URL (use host.docker.internal:8188 for local Mac/Windows)"
        echo "   - RunningHub API key (optional, for cloud workflows)"
        echo ""
        echo "You can also configure these settings in the Web UI after starting."
        echo ""
    else
        echo "❌ Error: config.example.yaml not found!"
        echo ""
        exit 1
    fi
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Error: docker-compose not found!"
    echo ""
    echo "Please install Docker Compose first:"
    echo "  https://docs.docker.com/compose/install/"
    echo ""
    exit 1
fi

# Use docker-compose or docker compose based on availability
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

# Use the full-stack deployment compose file (includes the web service).
COMPOSE_FILE="docker-compose.dev.yml"

echo "📦 Building Docker images..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" build

echo ""
echo "🚀 Starting services..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

echo ""
echo "✅ Pixelle-Video is now running!"
echo ""
echo "Services:"
echo "  🌐 Web UI:  http://localhost:8501"
echo "  🔌 API:     http://localhost:8001"
echo "  📚 API Docs: http://localhost:8001/docs"
echo ""
echo "Custom Resources (optional):"
echo "  📁 data/bgm/        - Custom background music (overrides default)"
echo "  📁 data/templates/  - Custom HTML templates (overrides default)"
echo "  📁 data/workflows/  - Custom ComfyUI workflows (overrides default)"
echo ""
echo "Useful commands:"
echo "  View logs:    $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo "  Stop:         $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo "  Restart:      $DOCKER_COMPOSE -f $COMPOSE_FILE restart"
echo "  Rebuild:      $DOCKER_COMPOSE -f $COMPOSE_FILE up -d --build"
echo ""

