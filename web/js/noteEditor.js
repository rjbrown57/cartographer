const NamespacePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export function ParseCommaList(value) {
    return Array.from(new Set(value.split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '')));
}
export function NormalizeNamespaceInput(value) {
    return value.trim().toLowerCase();
}
export function IsValidNamespace(namespace) {
    return NamespacePattern.test(namespace);
}
export function ParseDataValue(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return { value: null, error: '' };
    }
    try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
            return { value: null, error: 'Structured data must be a JSON object.' };
        }
        return { value: parsed, error: '' };
    }
    catch {
        return { value: null, error: 'Structured data must use valid JSON object syntax.' };
    }
}
export function FormatData(data) {
    if (!data || Object.keys(data).length === 0) {
        return '';
    }
    return JSON.stringify(data, null, 2);
}
export function DraftFingerprint(draft) {
    return JSON.stringify({
        id: draft.id,
        title: draft.title.trim(),
        url: draft.url.trim(),
        body: draft.body,
        tags: draft.tags,
        data: draft.data,
        namespace: NormalizeNamespaceInput(draft.namespace),
        source: draft.source.trim(),
        author: draft.author.trim(),
        createdAt: draft.createdAt || '',
    });
}
export function NormalizeTimestamp(value) {
    if (!value) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    const seconds = Number(value.seconds || 0);
    const nanos = Number(value.nanos || 0);
    if (!seconds && !nanos) {
        return '';
    }
    return new Date((seconds * 1000) + Math.floor(nanos / 1_000_000)).toISOString();
}
