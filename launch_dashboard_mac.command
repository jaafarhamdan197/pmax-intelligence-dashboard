#!/bin/bash
# PMax Dashboard Launcher — Mac
# Double-click this file to start the dashboard

# Find the folder where this script lives
DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if index.html exists in the same folder
if [ ! -f "$DIR/index.html" ]; then
  osascript -e 'display alert "index.html not found" message "Make sure launch_dashboard_mac.command and index.html are in the same folder."'
  exit 1
fi

# Check if port 8000 is already in use and kill it
lsof -ti:8000 | xargs kill -9 2>/dev/null

# Start Python server in the background from the script's folder
cd "$DIR"
python3 -m http.server 8000 &
SERVER_PID=$!

# Wait a moment for the server to start
sleep 1

# Open the browser
open "http://localhost:8000"

echo ""
echo "  PMax Dashboard is running at http://localhost:8000"
echo "  Press Ctrl+C to stop the server when you're done."
echo ""

# Keep script running so Ctrl+C stops the server cleanly
wait $SERVER_PID
