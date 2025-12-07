#!/bin/bash

# 將 pr-1 合併到 main 分支的腳本

set -e

echo "🔄 準備將 pr-1 合併到 main 分支..."
echo ""

# 檢查當前分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "pr-1" ]; then
    echo "⚠️  當前不在 pr-1 分支，正在切換..."
    git checkout pr-1
fi

# 檢查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  發現未提交的更改："
    git status --short
    echo ""
    read -p "是否先提交這些更改？(y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        read -p "輸入提交信息: " COMMIT_MSG
        git commit -m "$COMMIT_MSG"
        git push origin pr-1
    else
        echo "❌ 請先提交或暫存更改"
        exit 1
    fi
fi

# 確保遠程分支是最新的
echo "📥 拉取最新的 pr-1 分支..."
git pull origin pr-1

# 切換到 main 分支
echo "🔄 切換到 main 分支..."
git checkout main || git checkout master

# 拉取最新的 main
echo "📥 拉取最新的 main 分支..."
git pull origin main || git pull origin master

# 合併 pr-1
echo "🔀 合併 pr-1 到 main..."
git merge pr-1 --no-ff -m "Merge pr-1: Railway deployment fixes and debugging tools"

# 檢查是否有衝突
if [ $? -ne 0 ]; then
    echo "❌ 合併時發生衝突，請手動解決後運行："
    echo "   git add ."
    echo "   git commit -m 'Resolve merge conflicts'"
    exit 1
fi

# 推送到遠程
echo "📤 推送到遠程 main 分支..."
git push origin main || git push origin master

echo ""
echo "✅ 合併完成！"
echo ""
echo "📋 後續步驟："
echo "1. 確認 main 分支部署成功"
echo "2. 測試生產環境功能"
echo "3. 可選：刪除 pr-1 分支"
echo "   git branch -d pr-1"
echo "   git push origin --delete pr-1"




