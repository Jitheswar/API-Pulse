#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Set defaults
export PORT="${PORT:-5000}"
export FLASK_ENV="${FLASK_ENV:-development}"
export FLASK_DEBUG="${FLASK_DEBUG:-1}"

echo ""
echo "  API Pulse is running at http://localhost:${PORT}"
echo "  Press Ctrl+C to stop"
echo ""

# Run the Flask dev server
python run.py
