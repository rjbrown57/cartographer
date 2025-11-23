const CACHE_TTL_MS = 480 * 60 * 1000;
const CACHE_STORAGE_KEY = 'cartographer_cache';
const mainDataCache = new Map();
function loadCacheFromStorage() {
    try {
        const stored = localStorage.getItem(CACHE_STORAGE_KEY);
        if (stored) {
            const cacheData = JSON.parse(stored);
            Object.entries(cacheData).forEach(([key, value]) => {
                mainDataCache.set(key, value);
            });
        }
    }
    catch (err) {
        console.error('Error loading cache from localStorage:', err);
    }
}
function saveCacheToStorage() {
    try {
        const cacheData = {};
        mainDataCache.forEach((value, key) => {
            cacheData[key] = value;
        });
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheData));
    }
    catch (err) {
        console.error('Error saving cache to localStorage:', err);
    }
}
loadCacheFromStorage();
export function isCacheValid(cache) {
    if (!cache) {
        console.log('Cache entry not found');
        return false;
    }
    const now = Date.now();
    return (now - cache.timestamp) < cache.ttl;
}
export function getCacheEntry(queryPath) {
    let cachedEntry = mainDataCache.get(queryPath);
    if (!cachedEntry) {
        try {
            const stored = localStorage.getItem(CACHE_STORAGE_KEY);
            if (stored) {
                const cacheData = JSON.parse(stored);
                if (cacheData[queryPath]) {
                    cachedEntry = cacheData[queryPath];
                    mainDataCache.set(queryPath, cachedEntry);
                }
            }
        }
        catch (err) {
            console.error('Error reading from localStorage:', err);
        }
    }
    return cachedEntry;
}
export function setCacheEntry(queryPath, data) {
    const cacheEntry = {
        data: data,
        timestamp: Date.now(),
        ttl: CACHE_TTL_MS
    };
    mainDataCache.set(queryPath, cacheEntry);
    saveCacheToStorage();
}
export function getCacheSize() {
    return mainDataCache.size;
}
export function getCacheKeys() {
    return Array.from(mainDataCache.keys());
}
export function invalidateCache() {
    mainDataCache.clear();
    saveCacheToStorage();
}
