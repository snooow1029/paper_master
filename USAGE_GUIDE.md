# Paper Master 使用指南

## 📋 目錄
1. [如何獲取 Gemini API Key](#如何獲取-gemini-api-key)
2. [設定 Gemini API](#設定-gemini-api)
3. [啟動專案](#啟動專案)
4. [使用網頁介面](#使用網頁介面)
5. [功能說明](#功能說明)

---

## 🔑 如何獲取 Gemini API Key

### 步驟 1：前往 Google AI Studio
1. 打開瀏覽器，前往：**https://aistudio.google.com/**
2. 使用你的 Google 帳號登入

### 步驟 2：創建 API Key
1. 登入後，點擊左側選單的 **"Get API key"** 或 **"API Keys"**
2. 點擊 **"Create API Key"** 按鈕
3. 選擇：
   - **Create API key in new project**（在新專案中創建）
   - 或 **Create API key in existing project**（在現有專案中創建）
4. 複製生成的 API Key（格式類似：`AIzaSy...`）

### 步驟 3：保存 API Key
- **重要**：API Key 只會顯示一次，請立即複製並保存
- 如果忘記了，需要刪除舊的 Key 並創建新的

### 免費額度
- Google Gemini API 提供**免費額度**
- 每月有固定的免費請求次數
- 適合個人使用和小型專案

---

## ⚙️ 設定 Gemini API

### 1. 編輯環境變數文件
打開 `backend/.env` 文件，設定以下內容：

```env
# LLM 設定
LLM_TYPE=gemini
GEMINI_API_KEY=你的_Gemini_API_Key_這裡
GEMINI_MODEL=gemini-pro

# GROBID 設定
GROBID_URL=http://localhost:8070

# 服務器設定
PORT=5001
```

### 2. 可選設定
```env
# 如果不想使用 Gemini，可以設定為：
# LLM_TYPE=disabled  # 禁用 LLM（只能建立基本引用圖）
# LLM_TYPE=local_vllm  # 使用本地 VLLM 服務
# LLM_TYPE=openai  # 使用 OpenAI API（需要 OPENAI_API_KEY）
```

### 3. 保存文件
保存 `backend/.env` 文件後，需要重新啟動後端服務才會生效。

---

## 🚀 啟動專案

### 步驟 1：啟動 GROBID（如果還沒運行）
```powershell
# 檢查 GROBID 是否在運行
docker ps --filter "name=grobid"

# 如果沒有運行，啟動它
docker start grobid
# 或
docker run -d --name grobid -p 8070:8070 lfoppiano/grobid:0.8.2
```

### 步驟 2：啟動專案
在專案根目錄執行：
```powershell
npm run dev
```

這會同時啟動：
- **Backend**：http://localhost:5001
- **Frontend**：http://localhost:3000

### 步驟 3：打開瀏覽器
訪問：**http://localhost:3000**

---

## 💻 使用網頁介面

### 主頁面功能

#### 1. **輸入論文 URL**
- 在輸入框中貼上論文的 **arXiv URL**
  - 範例：`https://arxiv.org/abs/2301.00001`
  - 或：`https://arxiv.org/pdf/2301.00001.pdf`
- 也可以輸入多個 URL（用換行或逗號分隔）

#### 2. **選擇分析深度**
- **1-level 分析**（快速，約 3-5 分鐘）
  - 只分析輸入論文及其直接引用關係
- **2-level 分析**（深度，約 15-20 分鐘）
  - 分析兩層引用關係，建立更完整的知識圖譜

#### 3. **選擇分析區段**（可選）
- **Introduction**：引言部分
- **Related Work**：相關工作
- **全部**：分析整篇論文

#### 4. **開始分析**
- 點擊 **"Analyze"** 或 **"開始分析"** 按鈕
- 等待分析完成（會顯示進度）

### 圖譜視覺化頁面

#### 節點（Nodes）
- **代表**：一篇論文
- **顯示**：論文標題、作者、年份
- **點擊**：查看論文詳細資訊
- **拖動**：可以移動節點位置

#### 邊（Edges）
- **代表**：論文之間的關係
- **標籤**：顯示關係描述（例如："builds upon", "extends", "compares"）
- **點擊**：查看關係詳細資訊
- **顏色**：可能表示關係類型或強度

#### 互動功能
- **縮放**：使用滑鼠滾輪或觸控板
- **平移**：拖動空白區域
- **選擇**：點擊節點或邊
- **編輯**：可以編輯節點和邊的資訊
- **刪除**：可以刪除不需要的節點或邊

---

## 🎯 功能說明

### 核心功能

#### 1. **論文引用關係分析**
- 自動提取論文之間的引用關係
- 識別哪些論文引用了哪些論文
- 建立引用網絡圖

#### 2. **智能關係分析**（需要 Gemini API）
- 使用 AI 分析論文之間的**語義關係**
- 不只是引用，還分析：
  - **builds upon**：建立在...基礎上
  - **extends**：擴展了...
  - **applies**：應用了...
  - **compares**：比較了...
  - **surveys**：綜述了...
  - **critiques**：批評了...

#### 3. **可編輯圖譜**
- 手動添加、編輯、刪除節點和邊
- 自訂關係描述
- 保存你的知識圖譜

#### 4. **多論文輸入**
- 一次輸入多篇論文
- 自動分析它們之間的關係
- 建立完整的知識網絡

### 進階功能

#### 1. **Obsidian 整合**（開發中）
- 可以將圖譜同步到 Obsidian
- 生成 Juggl/Dataview 相容的 Markdown

#### 2. **圖譜分析**（開發中）
- PageRank 分析
- 中心性分析
- 社群檢測

---

## 📝 使用範例

### 範例 1：分析單篇論文
1. 輸入：`https://arxiv.org/abs/2301.00001`
2. 選擇：1-level 分析
3. 點擊：Analyze
4. 結果：看到這篇論文及其引用和被引用的論文

### 範例 2：比較多篇論文
1. 輸入多個 URL：
   ```
   https://arxiv.org/abs/2301.00001
   https://arxiv.org/abs/2302.00002
   https://arxiv.org/abs/2303.00003
   ```
2. 選擇：2-level 分析
3. 點擊：Analyze
4. 結果：看到這些論文之間的關係網絡

### 範例 3：深入分析特定領域
1. 輸入該領域的關鍵論文
2. 選擇：2-level 分析 + Related Work 區段
3. 點擊：Analyze
4. 結果：建立該領域的完整知識圖譜

---

## ⚠️ 注意事項

### 1. **GROBID 必須運行**
- 如果 GROBID 沒有運行，PDF 解析會失敗
- 確保 Docker 容器正在運行

### 2. **API 額度**
- Gemini API 有免費額度限制
- 如果超過額度，會自動降級到基本分析

### 3. **分析時間**
- 1-level 分析：約 3-5 分鐘
- 2-level 分析：約 15-20 分鐘
- 時間取決於論文的引用數量

### 4. **網路連接**
- 需要網路連接來下載論文 PDF
- 需要網路連接來調用 Gemini API

---

## 🔧 故障排除

### 問題 1：GROBID 連接失敗
**解決方案**：
```powershell
# 檢查 GROBID 是否運行
docker ps --filter "name=grobid"

# 重啟 GROBID
docker restart grobid
```

### 問題 2：Gemini API 錯誤
**檢查**：
1. API Key 是否正確設定在 `backend/.env`
2. API Key 是否有效（沒有過期或被撤銷）
3. 是否超過免費額度

### 問題 3：分析卡住
**解決方案**：
1. 檢查後端日誌是否有錯誤
2. 嘗試使用 1-level 分析（較快）
3. 檢查網路連接

### 問題 4：圖譜不顯示
**解決方案**：
1. 檢查瀏覽器控制台是否有錯誤
2. 嘗試重新整理頁面
3. 檢查前端是否正常運行

---

## 📚 更多資源

- **GitHub 專案**：https://github.com/snooow1029/paper_master
- **GROBID 文件**：https://grobid.readthedocs.io/
- **Gemini API 文件**：https://ai.google.dev/docs

---

## 💡 使用技巧

1. **從核心論文開始**：先分析領域的核心論文，再擴展
2. **使用 1-level 快速探索**：先用 1-level 快速了解，再用 2-level 深入
3. **編輯圖譜**：手動調整和補充關係，讓圖譜更準確
4. **保存重要圖譜**：定期保存你建立的知識圖譜

---

祝使用愉快！🎉




