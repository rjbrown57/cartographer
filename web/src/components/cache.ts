import type { CartoResponse } from '../types/types.js';

// Cache configuration
const CACHE_TTL_MS = 480 * 60 * 1000; // 8 hours default TTL
const CACHE_STORAGE_KEY = 'cartographer_cache';

export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

// Cache keyed by query path to handle different query parameters
// Use in-memory Map for fast access, but persist to localStorage
const mainDataCache: Map<string, CacheEntry<CartoResponse>> = new Map();

// Load cache from localStorage on initialization
function loadCacheFromStorage(): void {
    try {
        const stored = localStorage.getItem(CACHE_STORAGE_KEY);
        if (stored) {
            const cacheData = JSON.parse(stored);
            Object.entries(cacheData).forEach(([key, value]) => {
                mainDataCache.set(key, value as CacheEntry<CartoResponse>);
            });
        }
    } catch (err) {
        console.error('Error loading cache from localStorage:', err);
    }
}

// Save cache to localStorage
function saveCacheToStorage(): void {
    try {
        const cacheData: Record<string, CacheEntry<CartoResponse>> = {};
        mainDataCache.forEach((value, key) => {
            cacheData[key] = value;
        });
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheData));
    } catch (err) {
        console.error('Error saving cache to localStorage:', err);
    }
}

// Initialize cache from localStorage
loadCacheFromStorage();

export function isCacheValid<T>(cache: CacheEntry<T> | null | undefined): boolean {
    if (!cache) {
        console.log('Cache entry not found');
        return false;
    }
    const now = Date.now();
    return (now - cache.timestamp) < cache.ttl;
}

export function getCacheEntry(queryPath: string): CacheEntry<CartoResponse> | undefined {
    let cachedEntry = mainDataCache.get(queryPath);
    
    // Fallback: check localStorage if not in memory cache
    if (!cachedEntry) {
        try {
            const stored = localStorage.getItem(CACHE_STORAGE_KEY);
            if (stored) {
                const cacheData = JSON.parse(stored);
                if (cacheData[queryPath]) {
                    cachedEntry = cacheData[queryPath] as CacheEntry<CartoResponse>;
                    // Restore to memory cache
                    mainDataCache.set(queryPath, cachedEntry);
                }
            }
        } catch (err) {
            console.error('Error reading from localStorage:', err);
        }
    }
    
    return cachedEntry;
}

export function setCacheEntry(queryPath: string, data: CartoResponse): void {
    const cacheEntry: CacheEntry<CartoResponse> = {
        data: data,
        timestamp: Date.now(),
        ttl: CACHE_TTL_MS
    };
    mainDataCache.set(queryPath, cacheEntry);
    saveCacheToStorage(); // Persist to localStorage
}

export function getCacheSize(): number {
    return mainDataCache.size;
}

export function getCacheKeys(): string[] {
    return Array.from(mainDataCache.keys());
}

// Invalidate the cache by clearing the in-memory cache and saving to localStorage
export function invalidateCache(): void {
    mainDataCache.clear();
    saveCacheToStorage();
}