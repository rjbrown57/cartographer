import assert from 'node:assert/strict';
import test from 'node:test';

import { BuildNotesPath } from '../js/shared/api.js';
import { IsMobileBrowser } from '../js/shared/mobileBrowser.js';
import { CountMobileTags, GetMobileNoteType, MatchesMobileSearch } from '../js/mobile/model.js';

const note = {
    id: 'note-1',
    title: 'Database failover runbook',
    body: 'Recover the primary database safely.',
    url: '',
    tags: ['database', 'runbook'],
    source: 'operations',
};

test('BuildNotesPath preserves supported filters and mobile namespace state', () => {
    assert.equal(
        BuildNotesPath('platform', '?view=mobile&tag=runbook&tag=sre&term=failover'),
        '/v1/get?tag=runbook&tag=sre&term=failover&namespace=platform',
    );
});

test('mobile note search covers content metadata and requires every term', () => {
    assert.equal(MatchesMobileSearch(note, 'database operations'), true);
    assert.equal(MatchesMobileSearch(note, 'database security'), false);
    assert.equal(MatchesMobileSearch(note, ''), true);
});

test('mobile tag counts and note types are deterministic', () => {
    assert.deepEqual(CountMobileTags([
        note,
        { ...note, id: 'note-2', tags: ['database', 'incident'] },
    ]), [['database', 2], ['incident', 1], ['runbook', 1]]);
    assert.equal(GetMobileNoteType(note).label, 'Note');
    assert.equal(GetMobileNoteType({ ...note, url: 'https://example.com' }).label, 'Link');
    assert.equal(GetMobileNoteType({ ...note, data: { priority: 1 } }).label, 'Data');
});

test('mobile view control detection excludes desktop browsers', () => {
    const desktopChrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
    const mobileSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';

    assert.equal(IsMobileBrowser(desktopChrome), false);
    assert.equal(IsMobileBrowser(mobileSafari), true);
    assert.equal(IsMobileBrowser(mobileSafari, false), false);
    assert.equal(IsMobileBrowser(desktopChrome, true), true);
});
