/**
 * VISOR Unified Cache
 * LRU cache with TTL support and size limits.
 * Replaces the three unbounded Maps in groqService.ts.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
}

export class VisorCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly name: string;

  constructor(name: string, maxSize: number = 50, ttlMs: number = 15 * 60 * 1000) {
    this.name = name;
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.store.delete(key);
      return null;
    }

    entry.accessCount++;
    return entry.data;
  }

  set(key: string, data: T): void {
    // Evict LRU if at capacity
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this.evictLRU();
    }

    this.store.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 0,
    });
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  /** Get stale data even if TTL has expired — useful for fallback */
  getStale(key: string): T | null {
    return this.store.get(key)?.data ?? null;
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruAccess = Infinity;
    let lruTimestamp = Infinity;

    for (const [key, entry] of this.store.entries()) {
      // Evict expired entries first
      if (Date.now() - entry.timestamp > this.ttlMs) {
        this.store.delete(key);
        return;
      }
      // Then by access count, then by timestamp
      if (entry.accessCount < lruAccess || (entry.accessCount === lruAccess && entry.timestamp < lruTimestamp)) {
        lruKey = key;
        lruAccess = entry.accessCount;
        lruTimestamp = entry.timestamp;
      }
    }

    if (lruKey) {
      this.store.delete(lruKey);
    }
  }
}

// Pre-configured caches for VISOR services
export const newsCache = new VisorCache<any>('news', 20, 5 * 60 * 1000);       // 5 min TTL
export const weatherCache = new VisorCache<any>('weather', 30, 10 * 60 * 1000); // 10 min TTL
export const intelCache = new VisorCache<any>('intel', 30, 15 * 60 * 1000);     // 15 min TTL
export const riskCache = new VisorCache<any>('risk', 20, 30 * 60 * 1000);       // 30 min TTL
