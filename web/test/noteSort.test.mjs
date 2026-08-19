import assert from 'node:assert/strict';
import test from 'node:test';

import {
    GetNoteSortMode,
    SortNotes,
} from '../js/preferences/noteSort.js';

test('GetNoteSortMode accepts known modes and rejects unknown values', () => {
    assert.equal(GetNoteSortMode('other=value; cartographer_note_sort=title-desc'), 'title-desc');
    assert.equal(GetNoteSortMode('cartographer_note_sort=unsupported'), 'smart');
    assert.equal(GetNoteSortMode(''), 'smart');
});

test('SortNotes preserves relevance order for smart term searches', () => {
    const notes = [
        { id: 'older-result', updated_at: '2026-01-01T00:00:00Z' },
        { id: 'newer-result', updated_at: '2026-08-01T00:00:00Z' },
    ];

    const sorted = SortNotes(notes, 'smart', true);

    assert.deepEqual(sorted.map(note => note.id), ['older-result', 'newer-result']);
    assert.notEqual(sorted, notes);
});

test('SortNotes uses recent updates and creation fallback for smart browsing', () => {
    const notes = [
        { id: 'missing-date', title: 'Missing' },
        { id: 'created', title: 'Created', created_at: { seconds: 100 } },
        { id: 'updated', title: 'Updated', updated_at: { seconds: '200', nanos: 500_000_000 } },
    ];

    const sorted = SortNotes(notes, 'smart', false);

    assert.deepEqual(sorted.map(note => note.id), ['updated', 'created', 'missing-date']);
    assert.deepEqual(notes.map(note => note.id), ['missing-date', 'created', 'updated']);
});

test('SortNotes orders titles in both directions with stable ID tie breakers', () => {
    const notes = [
        { id: 'beta', title: 'Beta' },
        { id: 'alpha-2', title: 'alpha' },
        { id: 'alpha-1', title: 'Alpha' },
    ];

    assert.deepEqual(
        SortNotes(notes, 'title-asc', false).map(note => note.id),
        ['alpha-1', 'alpha-2', 'beta'],
    );
    assert.deepEqual(
        SortNotes(notes, 'title-desc', false).map(note => note.id),
        ['beta', 'alpha-2', 'alpha-1'],
    );
});
