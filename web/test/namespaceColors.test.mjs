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
}

globalThis.localStorage = new MemoryStorage();

const {
    GetNamespaceColors,
    SaveNamespaceColor,
} = await import('../js/types/types.js');

test('namespace colors persist and reset in browser storage', () => {
    SaveNamespaceColor('platform', '#d946ef');
    assert.deepEqual(GetNamespaceColors(), { platform: '#d946ef' });

    SaveNamespaceColor('platform', null);
    assert.deepEqual(GetNamespaceColors(), {});
});

test('namespace colors ignore malformed browser data', () => {
    localStorage.setItem('cartographer_namespace_colors', JSON.stringify({
        platform: '#38bdf8',
        invalid: 'red',
        '../unsafe': '#ffffff',
    }));

    assert.deepEqual(GetNamespaceColors(), { platform: '#38bdf8' });
});
