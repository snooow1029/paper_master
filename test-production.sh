#!/bin/bash

# 生产环境测试脚本
# 使用方法: ./test-production.sh <railway-url> <token>

RAILWAY_URL="${1:-${BACKEND_URL:-https://your-railway-backend.up.railway.app}}"
TOKEN="${2:-${TOKEN}}"

if [ -z "$TOKEN" ]; then
  echo "❌ 请提供 JWT token"
  echo ""
  echo "使用方法:"
  echo "  ./test-production.sh <railway-url> <token>"
  echo "  或"
  echo "  BACKEND_URL=<url> TOKEN=<token> ./test-production.sh"
  echo ""
  echo "示例:"
  echo "  ./test-production.sh https://app.up.railway.app eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  exit 1
fi

echo "🧪 测试生产环境 API"
echo "Backend URL: $RAILWAY_URL"
echo ""

# 测试 1: 健康检查
echo "1️⃣  健康检查..."
HEALTH_RESPONSE=$(curl -s "$RAILWAY_URL/api/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"OK"'; then
  echo "✅ 健康检查通过"
  echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
  echo "❌ 健康检查失败"
  echo "$HEALTH_RESPONSE"
  exit 1
fi
echo ""

# 测试 2: 获取用户信息
echo "2️⃣  获取用户信息..."
USER_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$RAILWAY_URL/api/auth/me")
if echo "$USER_RESPONSE" | grep -q '"id"'; then
  echo "✅ 用户信息获取成功"
  echo "$USER_RESPONSE" | jq '.' 2>/dev/null || echo "$USER_RESPONSE"
else
  echo "❌ 用户信息获取失败"
  echo "$USER_RESPONSE"
  exit 1
fi
echo ""

# 测试 3: 创建 Session
echo "3️⃣  创建 Session..."
SESSION_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "生产环境测试 Session", "description": "从脚本测试"}' \
  "$RAILWAY_URL/api/sessions")
if echo "$SESSION_RESPONSE" | grep -q '"id"'; then
  echo "✅ Session 创建成功"
  echo "$SESSION_RESPONSE" | jq '.' 2>/dev/null || echo "$SESSION_RESPONSE"
else
  echo "❌ Session 创建失败"
  echo "$SESSION_RESPONSE"
fi
echo ""

# 测试 4: 获取所有 Sessions
echo "4️⃣  获取所有 Sessions..."
SESSIONS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$RAILWAY_URL/api/sessions")
if echo "$SESSIONS_RESPONSE" | grep -q '^\['; then
  echo "✅ Sessions 列表获取成功"
  echo "$SESSIONS_RESPONSE" | jq '.' 2>/dev/null || echo "$SESSIONS_RESPONSE"
else
  echo "❌ Sessions 列表获取失败"
  echo "$SESSIONS_RESPONSE"
fi
echo ""

echo "✅ 所有测试完成！"

