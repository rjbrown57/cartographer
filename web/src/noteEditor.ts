export type NoteData = {
    id: string;
    title: string;
    url: string;
    body: string;
    tags: string[];
    data?: Record<string, any>;
    created_at?: TimestampValue;
    updated_at?: TimestampValue;
    source?: string;
    author?: string;
    version?: number;
}

export type TimestampValue = string | {
    seconds?: number | string;
    nanos?: number;
};

export type NoteDraft = {
    id: string;
    title: string;
    url: string;
    body: string;
    tags: string[];
    data: Record<string, any> | null;
    namespace: string;
    source: string;
    author: string;
    createdAt?: string;
};

export type DataParseResult = {
    value: Record<string, any> | null;
    error: string;
};

const NamespacePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// ParseCommaList returns unique, trimmed values from comma-separated input.
export function ParseCommaList(value: string): string[] {
    return Array.from(new Set(value.split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '')));
}

// NormalizeNamespaceInput converts raw text into the backend namespace shape.
export function NormalizeNamespaceInput(value: string): string {
    return value.trim().toLowerCase();
}

// IsValidNamespace checks input against the backend namespace rule.
export function IsValidNamespace(namespace: string): boolean {
    return NamespacePattern.test(namespace);
}

// ResolveReturnPath accepts only relative or same-origin navigation destinations.
export function ResolveReturnPath(value: string | null, origin: string): string | null {
    if (!value) {
        return null;
    }

    try {
        const destination = new URL(value, origin);
        if (destination.origin !== new URL(origin).origin) {
            return null;
        }
        return `${destination.pathname}${destination.search}${destination.hash}`;
    } catch {
        return null;
    }
}

// ParseDataValue validates optional structured data JSON.
export function ParseDataValue(value: string): DataParseResult {
    const trimmed = value.trim();
    if (!trimmed) {
        return { value: null, error: '' };
    }

    try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
            return { value: null, error: 'Structured data must be a JSON object.' };
        }
        return { value: parsed as Record<string, any>, error: '' };
    } catch {
        return { value: null, error: 'Structured data must use valid JSON object syntax.' };
    }
}

// FormatData converts non-empty structured data into stable JSON text.
export function FormatData(data?: Record<string, any>): string {
    if (!data || Object.keys(data).length === 0) {
        return '';
    }

    return JSON.stringify(data, null, 2);
}

// DraftFingerprint returns a normalized value for dirty-state comparisons.
export function DraftFingerprint(draft: NoteDraft): string {
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

// NormalizeTimestamp converts protobuf JSON timestamp objects into RFC3339 strings.
export function NormalizeTimestamp(value?: TimestampValue): string {
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
