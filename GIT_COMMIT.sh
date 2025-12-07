#!/bin/bash

# Railway 部署修復提交腳本

echo "📦 準備提交 Railway 部署修復..."

# 添加後端核心修復
echo "✅ 添加後端修復文件..."
git add backend/src/index.ts
git add backend/src/services/AdvancedCitationService.ts
git add backend/src/debug.ts
git add backend/src/start-server.ts
git add backend/package.json

# 添加 Railway 配置
echo "✅ 添加 Railway 配置文件..."
git add nixpacks.toml
git add railway.json
git add backend/.railwayignore

# 添加調試腳本
echo "✅ 添加調試腳本..."
git add backend/scripts/verify-pg.js
git add backend/scripts/check-deps.js

# 添加文檔
echo "✅ 添加文檔..."
git add DEBUG_GUIDE.md
git add QUICK_DEBUG.md
git add RAILWAY_PG_FIX.md
git add RAILWAY_SETUP.md
git add RAILWAY_TROUBLESHOOTING.md
git add PR_REVIEW_CHECKLIST.md
git add test_pr_compatibility.sh

# 顯示將要提交的文件
echo ""
echo "📋 將要提交的文件："
git status --short

echo ""
read -p "確認提交？(y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git commit -m "Fix Railway deployment issues and add debugging tools

- Fix server startup to handle database connection failures gracefully
- Fix AdvancedCitationService to not crash when GROBID_URL is not set  
- Add pg package verification script (prestart hook)
- Add Railway configuration files (nixpacks.toml, railway.json)
- Add debug endpoint (/api/debug) for troubleshooting
- Add comprehensive debugging documentation and guides
- Improve error handling to prevent service crashes"
    
    echo ""
    echo "✅ 提交完成！"
    echo "📤 使用 'git push' 推送到遠程倉庫"
else
    echo "❌ 取消提交"
fi




