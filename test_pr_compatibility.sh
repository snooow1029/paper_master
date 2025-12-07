#!/bin/bash

# PR #1 兼容性測試腳本
# 用於驗證新功能不會破壞現有功能

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"
TEST_ARXIV_URL="https://arxiv.org/abs/1706.03762"  # Attention Is All You Need

echo "🧪 PR #1 兼容性測試"
echo "API Base URL: $API_BASE_URL"
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 測試計數器
PASSED=0
FAILED=0

# 測試函數
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_field="$5"
    
    echo -n "測試: $name ... "
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null || echo "ERROR\n000")
    else
        response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL$endpoint" 2>/dev/null || echo "ERROR\n000")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        if [ -n "$expected_field" ]; then
            if echo "$body" | grep -q "$expected_field"; then
                echo -e "${GREEN}✓ PASSED${NC}"
                ((PASSED++))
            else
                echo -e "${RED}✗ FAILED${NC} (缺少字段: $expected_field)"
                echo "  響應: $body" | head -c 200
                echo ""
                ((FAILED++))
            fi
        else
            echo -e "${GREEN}✓ PASSED${NC}"
            ((PASSED++))
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo "  響應: $body" | head -c 200
        echo ""
        ((FAILED++))
    fi
}

# 1. 測試健康檢查端點
echo "📋 1. 基礎端點測試"
test_endpoint "健康檢查" "GET" "/api/health" "" "status"

# 2. 測試原有的圖構建功能（關鍵測試）
echo ""
echo "📋 2. 現有功能回歸測試"
test_endpoint "圖構建 API (原有功能)" "POST" "/api/graph/build-graph" \
    "{\"urls\": [\"$TEST_ARXIV_URL\"]}" \
    "graphData"

# 3. 測試原有響應字段完整性
echo ""
echo "📋 3. 響應字段完整性測試"
response=$(curl -s -X POST "$API_BASE_URL/api/graph/build-graph" \
    -H "Content-Type: application/json" \
    -d "{\"urls\": [\"$TEST_ARXIV_URL\"]}")

echo -n "檢查 graphData 字段 ... "
if echo "$response" | grep -q "\"graphData\""; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi

echo -n "檢查 statistics 字段 ... "
if echo "$response" | grep -q "\"statistics\""; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi

echo -n "檢查 nodes 數組 ... "
if echo "$response" | grep -q "\"nodes\""; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi

echo -n "檢查 edges 數組 ... "
if echo "$response" | grep -q "\"edges\""; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi

# 4. 測試新功能（可選，如果服務可用）
echo ""
echo "📋 4. 新功能測試（可選）"
test_endpoint "Prior Works API" "GET" "/api/citations/prior-works?url=$TEST_ARXIV_URL" "" "priorWorks"
test_endpoint "Derivative Works API" "GET" "/api/citations/derivative-works?url=$TEST_ARXIV_URL" "" "derivativeWorks"

# 5. 測試向後兼容性（原有參數）
echo ""
echo "📋 5. 向後兼容性測試"
test_endpoint "GROBID extract-citations (原有參數 arxivUrl)" "POST" "/api/grobid/extract-citations" \
    "{\"arxivUrl\": \"$TEST_ARXIV_URL\"}" \
    "citations"

test_endpoint "GROBID extract-citations (新參數 url)" "POST" "/api/grobid/extract-citations" \
    "{\"url\": \"$TEST_ARXIV_URL\"}" \
    "citations"

# 總結
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 測試結果總結"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}通過: $PASSED${NC}"
echo -e "${RED}失敗: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有測試通過！現有功能未受影響。${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  有 $FAILED 個測試失敗，請檢查上述錯誤。${NC}"
    exit 1
fi

