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

const {
    GetColor,
    GetColorPreferences,
    SetColor,
} = await import('../js/preferences/colors.js');

test('logical group colors persist independently and reset in browser storage', () => {
    const storage = new MemoryStorage();
    SetColor('namespace', 'Platform', '#D946EF', storage);
    SetColor('source', 'Cartographer', '#38BDF8', storage);

    assert.equal(GetColor('namespace', 'platform', storage), '#d946ef');
    assert.equal(GetColor('source', 'cartographer', storage), '#38bdf8');

    SetColor('namespace', 'platform', null, storage);
    assert.equal(GetColor('namespace', 'platform', storage), null);
    assert.equal(GetColor('source', 'cartographer', storage), '#38bdf8');
});

test('color preferences ignore malformed browser data', () => {
    const storage = new MemoryStorage();
    storage.setItem('cartographer_color_preferences', JSON.stringify({
        source: {
            cartographer: '#38bdf8',
            invalid: 'red',
        },
        tag: { incident: '#f97316' },
    }));

    assert.deepEqual(GetColorPreferences(storage).source, { cartographer: '#38bdf8' });
    assert.equal('tag' in GetColorPreferences(storage), false);
});

test('legacy namespace colors migrate on the next preference write', () => {
    const storage = new MemoryStorage();
    storage.setItem('cartographer_namespace_colors', JSON.stringify({ platform: '#d946ef' }));

    assert.equal(GetColor('namespace', 'platform', storage), '#d946ef');
    SetColor('source', 'cartographer', '#059669', storage);

    assert.equal(storage.getItem('cartographer_namespace_colors'), null);
    assert.equal(GetColor('namespace', 'platform', storage), '#d946ef');
});
