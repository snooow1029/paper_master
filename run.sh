#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
BACKEND_ENV_FILE="${BACKEND_DIR}/.env"

# Load environment variables from backend/.env if it exists
if [[ -f "$BACKEND_ENV_FILE" ]]; then
  echo "📋 Loading environment variables from ${BACKEND_ENV_FILE}..."
  # Export variables from .env file (handling comments and empty lines)
  # Use a safer method that handles spaces and special characters properly
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Trim leading/trailing whitespace
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    
    # Skip empty lines and comments
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    
    # Export variable (handle lines like KEY=value or KEY="value" or KEY='value')
    if [[ "$line" =~ ^[[:space:]]*([^=[:space:]]+)[[:space:]]*=[[:space:]]*(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      key="${key// /}"  # Remove any spaces from key
      value="${BASH_REMATCH[2]}"
      
      # Remove surrounding quotes if present (both single and double quotes)
      if [[ "$value" =~ ^\"(.*)\"$ ]]; then
        value="${BASH_REMATCH[1]}"
      elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi
      
      # Export the variable
      export "${key}=${value}"
    fi
  done < "$BACKEND_ENV_FILE"
  echo "✅ Environment variables loaded."
else
  echo "ℹ️  No .env file found at ${BACKEND_ENV_FILE}, using defaults."
fi

# Read LLM_TYPE from environment (default to 'local' if not set)
LLM_TYPE="${LLM_TYPE:-local}"
echo "🔧 LLM Type: ${LLM_TYPE}"

# Service configuration
OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11435}"
OLLAMA_ORIGINS="${OLLAMA_ORIGINS:-http://localhost:8000}"
LITELLM_MODEL="${LITELLM_MODEL:-ollama/qwen2.5:3b-instruct}"
LITELLM_PORT="${LITELLM_PORT:-8000}"
LITELLM_HOST="${LITELLM_HOST:-127.0.0.1}"
GROBID_URL="${GROBID_URL:-http://localhost:8070}"
GROBID_DIR="${GROBID_DIR:-${ROOT_DIR}/grobid-0.8.2}"

# Determine which services to start based on LLM_TYPE
NEED_OLLAMA=false
NEED_LITELLM=false

# Convert LLM_TYPE to lowercase for comparison (compatible with Bash 3.x)
LLM_TYPE_LOWER=$(echo "$LLM_TYPE" | tr '[:upper:]' '[:lower:]')

case "$LLM_TYPE_LOWER" in
  "local")
    NEED_OLLAMA=true
    NEED_LITELLM=true
    echo "🚀 Will start Ollama and LiteLLM for local LLM mode."
    ;;
  "gemini"|"openai"|"disabled")
    NEED_OLLAMA=false
    NEED_LITELLM=false
    echo "🌐 Using ${LLM_TYPE} mode - no local LLM services needed."
    ;;
  *)
    echo "⚠️  Unknown LLM_TYPE: ${LLM_TYPE}, defaulting to 'local' mode."
    NEED_OLLAMA=true
    NEED_LITELLM=true
    ;;
esac

declare -a PIDS=()

cleanup() {
  echo
  echo "🛑 Shutting down background services..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      echo "  Stopping PID $pid..."
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  
  # Stop Gradle daemon and clean up GROBID processes
  if [[ -d "$GROBID_DIR" ]]; then
    echo "  Stopping Gradle daemon..."
    (cd "$GROBID_DIR" && ./gradlew --stop >/dev/null 2>&1 || true)
  fi
  
  # Kill processes by pattern for better cleanup
  kill_processes_by_pattern "gradlew.*run" "GROBID" 2>/dev/null || true
  
  # Clean up any remaining processes on our ports (with error handling)
  local ollama_port="${OLLAMA_HOST##*:}"
  if [[ -n "$ollama_port" ]]; then
    kill_port_if_in_use "$ollama_port" "Ollama" 2>/dev/null || true
  fi
  if [[ "$NEED_LITELLM" == "true" ]] && [[ -n "$LITELLM_PORT" ]]; then
    kill_port_if_in_use "$LITELLM_PORT" "LiteLLM" 2>/dev/null || true
  fi
  
  # Extract GROBID port from URL
  local grobid_port="${GROBID_PORT:-8070}"
  if [[ -z "$grobid_port" ]]; then
    grobid_port="$(echo "$GROBID_URL" | sed -nE 's|^[^:]+://[^:]+:([0-9]+).*|\1|p')"
    [[ -z "$grobid_port" ]] && grobid_port="8070"
  fi
  kill_port_if_in_use "$grobid_port" "GROBID" 2>/dev/null || true
  
  # Clean up Node.js processes (npm run dev, nodemon, etc.)
  echo "  Cleaning up Node.js processes..."
  kill_processes_by_pattern "npm.*run.*dev" "npm dev" 2>/dev/null || true
  kill_processes_by_pattern "nodemon" "nodemon" 2>/dev/null || true
  
  echo "✅ Cleanup complete."
}
trap cleanup EXIT

# Check for required commands based on LLM_TYPE
if [[ "$NEED_OLLAMA" == "true" ]]; then
  command -v ollama >/dev/null 2>&1 || { echo "❌ Error: ollama is not installed or not in PATH. Install it from https://ollama.ai"; exit 1; }
fi

if [[ "$NEED_LITELLM" == "true" ]]; then
  command -v litellm >/dev/null 2>&1 || { echo "❌ Error: litellm CLI is not installed. Install it with: pip install litellm"; exit 1; }
fi

# Check for GROBID
if [[ ! -d "$GROBID_DIR" ]]; then
  echo "⚠️  Warning: GROBID directory not found at ${GROBID_DIR}"
  echo "   GROBID service will be skipped."
fi

start_bg() {
  local name="$1"
  shift
  echo "Starting ${name}..."
  ("$@") &
  local pid=$!
  PIDS+=("$pid")
  echo "${name} started with PID ${pid}"
}

start_bg_in_dir() {
  local name="$1"
  local dir="$2"
  shift 2
  echo "Starting ${name} in ${dir}..."
  (cd "$dir" && "$@") &
  local pid=$!
  PIDS+=("$pid")
  echo "${name} started with PID ${pid}"
}

kill_port_if_in_use() {
  local port="$1"
  local service_name="${2:-service}"
  
  # 检查端口是否被占用（兼容 macOS 和 Linux）
  local pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $2}' | sort -u)
  
  if [[ -z "$pids" ]]; then
    return 0  # 端口未被占用，正常返回
  fi
  
  echo "⚠️  Port $port is already in use by ${service_name}. Killing process(es)..."
  for pid in $pids; do
    if [[ -n "$pid" ]] && [[ "$pid" =~ ^[0-9]+$ ]]; then
      # 获取进程信息以便更好地识别
      local proc_info=$(ps -p "$pid" -o command= 2>/dev/null || echo "unknown")
      echo "  Killing PID $pid: ${proc_info:0:60}..."
      kill "$pid" 2>/dev/null || true
    fi
  done
  
  sleep 1
  
  # 再次检查，如果还在运行，强制杀掉
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $2}' | sort -u)
  for pid in $pids; do
    if [[ -n "$pid" ]] && [[ "$pid" =~ ^[0-9]+$ ]]; then
      echo "  Force killing PID $pid..."
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  
  sleep 1
  echo "✅ Port $port is now free."
}

# Enhanced function to kill processes by name pattern
kill_processes_by_pattern() {
  local pattern="$1"
  local service_name="${2:-service}"
  
  # Find processes matching the pattern (excluding grep itself)
  local pids=$(ps aux | grep -i "$pattern" | grep -v grep | awk '{print $2}' | sort -u)
  
  if [[ -z "$pids" ]]; then
    return 0  # No processes found
  fi
  
  echo "⚠️  Found existing ${service_name} processes. Killing..."
  for pid in $pids; do
    if [[ -n "$pid" ]] && [[ "$pid" =~ ^[0-9]+$ ]]; then
      local proc_info=$(ps -p "$pid" -o command= 2>/dev/null || echo "unknown")
      echo "  Killing PID $pid: ${proc_info:0:60}..."
      kill "$pid" 2>/dev/null || true
    fi
  done
  
  sleep 1
  
  # Force kill if still running
  pids=$(ps aux | grep -i "$pattern" | grep -v grep | awk '{print $2}' | sort -u)
  for pid in $pids; do
    if [[ -n "$pid" ]] && [[ "$pid" =~ ^[0-9]+$ ]]; then
      echo "  Force killing PID $pid..."
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  
  sleep 1
  echo "✅ ${service_name} processes cleaned up."
}

wait_for_port() {
  local host="$1"
  local port="$2"
  local retries="${3:-30}"
  local service_name="${4:-service}"
  local count=0
  
  echo "Waiting for ${service_name} to be ready on ${host}:${port}..."
  while ! nc -z "$host" "$port" >/dev/null 2>&1; do
    retries=$((retries - 1))
    count=$((count + 1))
    
    # 每 10 秒输出一次进度
    if [[ $((count % 10)) -eq 0 ]]; then
      echo "  Still waiting for ${service_name}... (${count}s elapsed, ${retries} retries remaining)"
    fi
    
    if [[ "$retries" -le 0 ]]; then
      echo "⚠️  Timeout waiting for ${service_name} on ${host}:${port} after ${count} seconds"
      echo "   Service may still be starting. Continuing anyway..."
      return 1
    fi
    sleep 1
  done
  
  echo "✅ ${service_name} is ready on ${host}:${port} (took ${count}s)"
  return 0
}

# Pre-cleanup: Kill existing processes before starting new ones
echo "🧹 Cleaning up existing processes..."

# Kill existing Ollama processes if needed
if [[ "$NEED_OLLAMA" == "true" ]]; then
  kill_processes_by_pattern "ollama.*serve" "Ollama" 2>/dev/null || true
fi

# Kill existing LiteLLM processes if needed
if [[ "$NEED_LITELLM" == "true" ]]; then
  kill_processes_by_pattern "litellm" "LiteLLM" 2>/dev/null || true
fi

# Kill existing GROBID processes
kill_processes_by_pattern "gradlew.*run" "GROBID" 2>/dev/null || true

# Kill existing Node.js dev processes
kill_processes_by_pattern "npm.*run.*dev" "npm dev" 2>/dev/null || true
kill_processes_by_pattern "nodemon" "nodemon" 2>/dev/null || true

sleep 2
echo "✅ Cleanup complete. Starting fresh services..."
echo

# Start Ollama (only if needed)
if [[ "$NEED_OLLAMA" == "true" ]]; then
  OLLAMA_BIND_HOST="${OLLAMA_HOST%:*}"
  OLLAMA_BIND_PORT="${OLLAMA_HOST##*:}"
  kill_port_if_in_use "$OLLAMA_BIND_PORT" "Ollama"
  start_bg "Ollama" env OLLAMA_HOST="$OLLAMA_HOST" OLLAMA_ORIGINS="$OLLAMA_ORIGINS" ollama serve
  wait_for_port "$OLLAMA_BIND_HOST" "$OLLAMA_BIND_PORT" 30 "Ollama" || echo "⚠️  Ollama port check failed, but continuing..."
else
  echo "⏭️  Skipping Ollama (LLM_TYPE=${LLM_TYPE} does not require local LLM)"
fi

# Start LiteLLM bridge (only if needed)
if [[ "$NEED_LITELLM" == "true" ]]; then
  kill_port_if_in_use "$LITELLM_PORT" "LiteLLM"
  start_bg "LiteLLM bridge" litellm --model "$LITELLM_MODEL" --api_base "http://${OLLAMA_HOST}" --host "$LITELLM_HOST" --port "$LITELLM_PORT"
  wait_for_port "$LITELLM_HOST" "$LITELLM_PORT" 30 "LiteLLM" || echo "⚠️  LiteLLM port check failed, but continuing..."
else
  echo "⏭️  Skipping LiteLLM (LLM_TYPE=${LLM_TYPE} does not require local LLM)"
fi

# Start GROBID (always needed)
GROBID_HOST="$(echo "$GROBID_URL" | sed -E 's|^[^:]+://([^:/]+).*|\1|')"
GROBID_PORT="$(echo "$GROBID_URL" | sed -nE 's|^[^:]+://[^:]+:([0-9]+).*|\1|p')"
if [[ -z "$GROBID_HOST" ]]; then
  GROBID_HOST="localhost"
fi
if [[ -z "$GROBID_PORT" ]]; then
  GROBID_PORT="8070"
fi

if [[ -d "$GROBID_DIR" ]]; then
  kill_port_if_in_use "$GROBID_PORT" "GROBID"
  start_bg_in_dir "GROBID" "$GROBID_DIR" ./gradlew run
  
  # GROBID 需要更長的啟動時間（通常 2-3 分鐘），等待 120 秒
  wait_for_port "$GROBID_HOST" "$GROBID_PORT" 120 "GROBID" || {
    echo "⚠️  GROBID may still be starting. This is normal - it can take 2-3 minutes."
    echo "   Continuing anyway - GROBID will be ready soon."
  }
else
  echo "⚠️  Warning: GROBID directory not found. GROBID service will not be started."
fi

echo
echo "All background services are up."
echo "Starting Paper Master dev servers..."
echo

cd "$ROOT_DIR"
npm run dev

