import assert from 'node:assert/strict';
import test from 'node:test';

class MemoryStorage {
    values = new Map();

    getItem(key) {
        return this.values.get(key) ?? null;
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

globalThis.localStorage = new MemoryStorage();

const cache = await import('../js/components/cache.js');

test('note cache preference defaults on and bypasses storage when disabled', () => {
    const queryPath = '/v1/get?namespace=default';
    const response = { notes: [], namespace: 'default' };

    assert.equal(cache.isNoteCacheEnabled(), true);
    cache.setCacheEntry(queryPath, response);
    assert.deepEqual(cache.getCacheEntry(queryPath)?.data, response);

    cache.setNoteCacheEnabled(false);
    assert.equal(cache.isNoteCacheEnabled(), false);
    assert.equal(cache.getCacheEntry(queryPath), undefined);
    assert.deepEqual(cache.getCacheKeys(), []);
    assert.equal(localStorage.getItem('cartographer_cache'), null);

    cache.setCacheEntry(queryPath, response);
    assert.equal(cache.getCacheEntry(queryPath), undefined);

    cache.setNoteCacheEnabled(true);
    cache.setCacheEntry(queryPath, response);
    assert.deepEqual(cache.getCacheEntry(queryPath)?.data, response);
});
