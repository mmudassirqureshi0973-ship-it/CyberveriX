#!/usr/bin/env bash
# CyberVeriX start script (macOS / Linux)
set -e
cd "$(dirname "$0")"

PY=python3
command -v python3 >/dev/null 2>&1 || PY=python
command -v "$PY" >/dev/null 2>&1 || { echo "Python 3.9+ is required but was not found."; exit 1; }

echo "Starting CyberVeriX on http://127.0.0.1:8000"
echo "Demo login: student@cyberverix.local / Cyber@1234"
echo "Press Ctrl+C to stop."
exec "$PY" backend/app.py --port 8000
