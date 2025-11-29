# 啟動指南

## Windows PowerShell 用戶

### 第一步：安裝依賴

執行 PowerShell 腳本（會自動安裝所有依賴並檢查端口）：
```powershell
.\start-dev.ps1
```

或者手動安裝：
```powershell
# 安裝後端依賴
cd backend
npm install
npm install pg@^8.16.3 typeorm@^0.3.17
cd ..

# 安裝前端依賴
cd frontend
npm install
cd ..
```

### 第二步：分別啟動（推薦）

**方法 A: 使用啟動腳本（推薦）**

**終端 1 - 啟動後端：**
```powershell
.\start-backend.ps1
```

**終端 2 - 啟動前端：**
```powershell
.\start-frontend.ps1
```

**方法 B: 手動啟動**

**終端 1 - 啟動後端：**
```powershell
cd backend
npm run dev
```

**終端 2 - 啟動前端：**
```powershell
cd frontend
npm run dev
```

## 重要依賴說明

- **pg**: PostgreSQL 數據庫的 Node.js 驅動程序，用於連接 PostgreSQL 數據庫
- **typeorm**: TypeScript ORM（對象關係映射）框架，用於數據庫操作和實體管理

這些套件在 `package.json` 中已定義，但如果安裝失敗，需要手動安裝。

## 端口配置

- **後端**: http://localhost:8080 (或 5001，取決於 .env 配置)
- **前端**: http://localhost:3000

## 檢查服務是否運行

- 後端健康檢查: http://localhost:8080/api/health
- 前端: http://localhost:3000

## 常見問題

### 1. `ECONNREFUSED` 錯誤
表示後端沒有啟動。請先啟動後端，等它運行後再啟動前端。

### 2. `EADDRINUSE` 錯誤
端口已被占用。解決方法：
```powershell
# 查找占用端口的進程
Get-NetTCPConnection -LocalPort 8080

# 停止 Node 進程
Get-Process -Name node | Stop-Process -Force
```

### 3. `pg` 或 `typeorm` 未找到
手動安裝：
```powershell
cd backend
npm install pg@^8.16.3 typeorm@^0.3.17
```

### 4. `Services not ready - GROBID: false` 錯誤
**這是主要問題！** GROBID 服務沒有運行。

**解決方法：**

**選項 A: 使用 Docker（推薦，Windows 最簡單）**
```powershell
# 啟動 GROBID Docker 容器
docker run --rm -d -p 8070:8070 lfoppiano/grobid:0.8.2

# 檢查是否運行
docker ps
```

**選項 B: 手動下載並啟動 GROBID**
1. 下載 GROBID 0.8.2: https://github.com/kermitt2/grobid/releases/tag/0.8.2
2. 解壓縮到專案根目錄，命名為 `grobid-0.8.2`
3. 在終端中執行：
```powershell
cd grobid-0.8.2
.\gradlew.bat run
```

**選項 C: 暫時跳過 GROBID（僅測試其他功能）**
如果只是想測試前端和後端連接，可以修改後端代碼暫時跳過 GROBID 檢查，但這會限制功能。

**驗證 GROBID 是否運行：**
```powershell
# 測試 GROBID 服務
Invoke-WebRequest -Uri "http://localhost:8070/api/isalive" -UseBasicParsing
```

### 5. 前端 404 錯誤
如果看到 404 錯誤：
1. **確保前端已重新啟動**（讓 vite 配置生效）
2. 檢查瀏覽器 Network 標籤，確認請求的實際 URL
3. 確認後端在正確的端口運行（5001 或 8080）

