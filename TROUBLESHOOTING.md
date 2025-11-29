# 圖譜沒有連接的故障排除指南

## 🔍 問題：圖譜中的節點之間沒有連接（邊）

### 可能的原因和解決方案

#### 1. **分析深度設定問題**

**問題**：如果選擇 "Source only" (expansion depth: 0)，系統只會分析你輸入的論文之間的直接關係。

**解決方案**：
- 選擇 **"1 layer deep"** 或 **"2 layers deep"**
- 這樣系統會：
  - 提取輸入論文的引用（cited papers）
  - 提取引用輸入論文的論文（citing papers）
  - 分析這些論文之間的關係
  - 建立更完整的知識圖譜

**建議**：
- 第一次分析：使用 **"1 layer deep"**（較快，約 3-5 分鐘）
- 深入分析：使用 **"2 layers deep"**（較慢，約 15-20 分鐘，但更完整）

---

#### 2. **Smart Filter 過濾過嚴**

**問題**：Smart Filter 可能會過濾掉所有論文對，導致沒有邊。

**解決方案**：
- 取消勾選 **"Smart Section Filter"**
- 這樣系統會分析所有論文對，而不是只分析相關的對

**注意**：
- 關閉 Smart Filter 會增加分析時間
- 但會確保所有可能的關係都被分析

---

#### 3. **論文之間確實沒有關係**

**問題**：如果輸入的論文來自完全不同的領域，它們之間可能真的沒有關係。

**解決方案**：
- 輸入**相關領域**的論文
- 例如：
  - Transformer 相關：`1706.03762`, `1810.04805`, `2005.14165`
  - 計算機視覺：相關的 CV 論文
  - 自然語言處理：相關的 NLP 論文

---

#### 4. **檢查後端日誌**

**如何查看**：
1. 查看運行 `npm run dev` 的終端
2. 尋找以下訊息：
   - `Smart Filter selected X pairs for LLM analysis`
   - `Total pairs to analyze: X`
   - `Analyzing relationship between...`

**如果看到**：
- `Smart Filter selected 0 pairs` → Smart Filter 過濾掉了所有對
- `Total pairs to analyze: 0` → 沒有論文對需要分析
- `No relationships found` → LLM 沒有找到關係

---

## 🎯 推薦的測試方式

### 方式 1：使用相關論文（推薦）

輸入同一領域的論文：
```
https://arxiv.org/abs/1706.03762  (Transformer)
https://arxiv.org/abs/1810.04805  (BERT)
https://arxiv.org/abs/2005.14165  (GPT-3)
```

這些論文之間有明顯的關係，應該會產生連接。

### 方式 2：增加分析深度

1. 輸入 1-2 篇核心論文
2. 選擇 **"1 layer deep"** 或 **"2 layers deep"**
3. 系統會自動提取相關論文並建立連接

### 方式 3：關閉 Smart Filter

1. 取消勾選 **"Smart Section Filter"**
2. 選擇 **"Source only"**
3. 這樣會分析所有論文對，即使關係較弱

---

## 📊 檢查分析結果

### 在後端日誌中查看：

```
=== Building Paper Graph from X URLs ===
--- Step 1: Extracting Paper Data with GROBID ---
✅ Extracted: [論文標題]

--- Step 2: Analyzing Relationships with LLM ---
Expanded to X total papers

🔍 Applying Smart Filter to X papers...
✅ Smart Filter selected X pairs for LLM analysis

Analyzing relationship between [論文A] and [論文B]...
✅ Found relationship: builds_on
```

### 如果沒有看到 "Found relationship"：
- 可能是論文之間真的沒有關係
- 或者 Smart Filter 過濾掉了
- 或者 LLM 分析失敗

---

## 🔧 快速修復步驟

1. **確保分析深度不是 "Source only"**
   - 選擇 "1 layer deep" 或 "2 layers deep"

2. **嘗試關閉 Smart Filter**
   - 取消勾選 "Smart Section Filter"

3. **使用相關論文**
   - 輸入同一領域的論文

4. **檢查後端日誌**
   - 查看是否有錯誤訊息
   - 查看分析了多少論文對

5. **重新分析**
   - 點擊 "Start Analysis" 重新開始

---

## 💡 最佳實踐

1. **從核心論文開始**：輸入 1-2 篇領域核心論文
2. **使用 1 layer deep**：快速建立基本圖譜
3. **保持 Smart Filter 開啟**：提高分析效率
4. **逐步擴展**：根據結果決定是否需要 2 layer deep

---

如果按照以上步驟還是沒有連接，請檢查後端日誌並告訴我具體的錯誤訊息。




