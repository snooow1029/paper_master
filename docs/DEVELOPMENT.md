# Paper Master 開發指南

## 項目概述

Paper Master 是一個互動式學術論文視覺化工具，類似於 Connected Papers，可以：

1. **論文輸入**: 支援多篇論文 URL（arXiv、DOI 等）
2. **智能分析**: 自動抓取論文 metadata 並分析關係
3. **視覺化**: 生成可互動編輯的論文連結圖
4. **AI 輔助**: 使用 LLM 自動生成關係摘要
5. **即時編輯**: 動態新增、編輯、刪除節點與邊

## 技術棧

### 前端
- **框架**: React + TypeScript
- **UI 組件**: Material-UI (MUI)
- **圖形視覺化**: vis.js/vis-network
- **狀態管理**: React Hooks + Context
- **路由**: React Router
- **建置工具**: Vite

### 後端
- **運行環境**: Node.js + TypeScript
- **框架**: Express.js
- **資料庫**: SQLite + TypeORM
- **論文抓取**: Axios + Cheerio
- **AI 分析**: OpenAI API
- **開發工具**: Nodemon

## 開發環境設置

### 1. 安裝依賴
```bash
npm run install:all
```

### 2. 配置環境變數
複製 `backend/.env.example` 到 `backend/.env` 並配置：
```env
NODE_ENV=development
PORT=5000
OPENAI_API_KEY=your_openai_api_key_here
CORS_ORIGIN=http://localhost:3000
```

### 3. 開發模式
```bash
npm run dev
```

### 4. 瀏覽器訪問
- 前端: http://localhost:3000
- 後端 API: http://localhost:5000/api

## 項目結構

```
paper-master/
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── components/       # React 組件
│   │   │   ├── Graph/        # 圖形相關組件
│   │   │   └── Layout/       # 佈局組件
│   │   ├── pages/            # 頁面組件
│   │   ├── types/            # TypeScript 類型
│   │   └── main.tsx          # 入口文件
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # Node.js 後端
│   ├── src/
│   │   ├── controllers/      # API 控制器
│   │   ├── entities/         # 資料庫實體
│   │   ├── services/         # 業務邏輯
│   │   ├── routes/           # API 路由
│   │   ├── config/           # 配置文件
│   │   └── index.ts          # 入口文件
│   ├── package.json
│   └── tsconfig.json
├── shared/                   # 共享代碼
│   ├── types/                # 共享類型定義
│   ├── utils/                # 共享工具函數
│   └── constants/            # 共享常數
├── docs/                     # 文檔
├── package.json              # 根項目配置
└── README.md
```

## API 端點

### 論文分析
- `POST /api/papers/analyze`
  - 輸入: `{ urls: string[] }`
  - 輸出: `{ papers, nodes, edges }`

### 論文管理
- `GET /api/papers` - 獲取所有論文
- `GET /api/papers/:id` - 獲取單篇論文
- `PUT /api/papers/:id` - 更新論文
- `DELETE /api/papers/:id` - 刪除論文

### 健康檢查
- `GET /api/health` - 服務狀態檢查

## 核心功能實現

### 1. 論文抓取
- **arXiv**: 使用 arXiv API
- **DOI**: 解析 DOI 服務或直接抓取
- **通用**: 網頁抓取 + 元數據提取

### 2. 關係分析
- **AI 模式**: 使用 OpenAI API 分析論文關係
- **基礎模式**: 關鍵詞相似度計算

### 3. 圖形渲染
- **節點**: 論文資訊展示
- **邊**: 關係類型與描述
- **互動**: 拖曳、縮放、編輯

### 4. 資料持久化
- **SQLite**: 本地資料庫
- **TypeORM**: ORM 框架
- **實體關係**: Paper ↔ PaperRelation

## 開發注意事項

### 1. OpenAI API
- 需要有效的 API 密鑰
- 沒有密鑰時自動降級到基礎模式
- 注意 API 使用限制和費用

### 2. 論文抓取
- 遵守網站的 robots.txt
- 實現請求頻率限制
- 處理各種錯誤情況

### 3. 性能優化
- 圖形渲染優化（大型圖）
- 論文抓取並行處理
- 資料庫查詢優化

### 4. 錯誤處理
- 網路錯誤恢復
- 無效 URL 處理
- API 限制處理

## 部署說明

### 生產環境
```bash
npm run build
npm start
```

### 環境變數配置
```env
NODE_ENV=production
PORT=5000
OPENAI_API_KEY=prod_api_key
CORS_ORIGIN=https://your-domain.com
```

## 未來改進

1. **功能擴展**
   - 更多論文源支援
   - 批量匯入功能
   - 圖表導出功能

2. **性能優化**
   - 圖形虛擬化
   - 快取機制
   - CDN 部署

3. **用戶體驗**
   - 拖拽上傳
   - 預設模板
   - 協作功能

## 故障排除

### 常見問題
1. **後端啟動失敗**: 檢查 OpenAI API 密鑰配置
2. **論文抓取失敗**: 檢查網路連接和 URL 格式
3. **圖形渲染問題**: 檢查瀏覽器兼容性

### 日誌查看
- 後端日誌: 終端輸出
- 前端日誌: 瀏覽器開發者工具
- 錯誤追蹤: 檢查 API 回應狀態
