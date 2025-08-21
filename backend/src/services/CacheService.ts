/**
 * 簡單的內存緩存服務 - 加速重複論文處理
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
}

export class CacheService {
  private static cache: Map<string, CacheEntry<any>> = new Map();
  private static readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

  /**
   * 設置緩存
   */
  static set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    
    console.log(`📦 Cache SET: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * 獲取緩存
   */
  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      console.log(`❌ Cache MISS: ${key}`);
      return null;
    }

    // 檢查是否過期
    if (Date.now() - entry.timestamp > entry.ttl) {
      console.log(`⏰ Cache EXPIRED: ${key}`);
      this.cache.delete(key);
      return null;
    }

    console.log(`✅ Cache HIT: ${key}`);
    return entry.data as T;
  }

  /**
   * 檢查緩存是否存在且未過期
   */
  static has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 清除特定緩存
   */
  static delete(key: string): boolean {
    console.log(`🗑️ Cache DELETE: ${key}`);
    return this.cache.delete(key);
  }

  /**
   * 清除所有緩存
   */
  static clear(): void {
    console.log(`🧹 Cache CLEAR ALL (${this.cache.size} entries)`);
    this.cache.clear();
  }

  /**
   * 獲取緩存統計
   */
  static getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * 清理過期緩存
   */
  static cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cache cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * 生成論文緩存 key
   */
  static paperKey(url: string): string {
    return `paper:${url}`;
  }

  /**
   * 生成 Semantic Scholar 緩存 key  
   */
  static semanticScholarKey(arxivId: string): string {
    return `semantic:${arxivId}`;
  }

  /**
   * 生成 arXiv 推斷緩存 key
   */
  static arxivInferKey(title: string): string {
    return `arxiv_infer:${title.slice(0, 50)}`;
  }
}
