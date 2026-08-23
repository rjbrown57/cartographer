import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DraftFingerprint,
    FormatData,
    IsValidNamespace,
    NormalizeNamespaceInput,
    NormalizeTimestamp,
    ParseCommaList,
    ParseDataValue,
    ResolveReturnPath,
} from '../js/noteEditor.js';

test('ParseCommaList trims, removes blanks, and preserves unique order', () => {
    assert.deepEqual(ParseCommaList(' ops, runbook, ops, , incident '), ['ops', 'runbook', 'incident']);
});

test('namespace helpers normalize author input and enforce backend-safe names', () => {
    assert.equal(NormalizeNamespaceInput(' Platform-Ops '), 'platform-ops');
    assert.equal(IsValidNamespace('platform-ops'), true);
    assert.equal(IsValidNamespace('-platform'), false);
    assert.equal(IsValidNamespace('platform_ops'), false);
});

test('ResolveReturnPath preserves same-origin state and rejects unsafe destinations', () => {
    const origin = 'https://cartographer.example';

    assert.equal(
        ResolveReturnPath('/?namespace=security&tag=incident#notes', origin),
        '/?namespace=security&tag=incident#notes',
    );
    assert.equal(
        ResolveReturnPath('https://cartographer.example/?term=checkout', origin),
        '/?term=checkout',
    );
    assert.equal(ResolveReturnPath('https://example.com/phishing', origin), null);
    assert.equal(ResolveReturnPath('//example.com/phishing', origin), null);
    assert.equal(ResolveReturnPath('http://[', origin), null);
    assert.equal(ResolveReturnPath(null, origin), null);
});

test('ParseDataValue accepts optional objects and explains invalid values', () => {
    assert.deepEqual(ParseDataValue(''), { value: null, error: '' });
    assert.deepEqual(ParseDataValue('{"priority": 1}'), { value: { priority: 1 }, error: '' });
    assert.match(ParseDataValue('["not", "an", "object"]').error, /JSON object/);
    assert.match(ParseDataValue('{').error, /valid JSON/);
});

test('FormatData and NormalizeTimestamp produce stable editor values', () => {
    assert.equal(FormatData({ priority: 1 }), '{\n  "priority": 1\n}');
    assert.equal(FormatData({}), '');
    assert.equal(NormalizeTimestamp({ seconds: 2, nanos: 500_000_000 }), '1970-01-01T00:00:02.500Z');
});

test('DraftFingerprint ignores incidental field whitespace but preserves markdown', () => {
    const draft = {
        id: 'note-1',
        title: ' Runbook ',
        url: ' https://example.com ',
        body: '# Runbook\n',
        tags: ['ops'],
        data: null,
        namespace: ' DEFAULT ',
        source: ' cartographer ',
        author: ' Riley ',
    };
    const normalized = {
        ...draft,
        title: 'Runbook',
        url: 'https://example.com',
        namespace: 'default',
        source: 'cartographer',
        author: 'Riley',
    };

    assert.equal(DraftFingerprint(draft), DraftFingerprint(normalized));
    assert.notEqual(DraftFingerprint(draft), DraftFingerprint({ ...draft, body: '# Runbook' }));
});
