import type { NoteData, TimestampValue } from '../shared/types.js';

export type MobileNoteType = {
    className: string;
    icon: string;
    label: string;
};

// GetMobileNoteType returns compact visual metadata for a mobile feed item.
export function GetMobileNoteType(note: NoteData): MobileNoteType {
    if (note.data && Object.keys(note.data).length > 0) {
        return { className: 'mobile-note--data', icon: 'bi bi-braces', label: 'Data' };
    }
    if (note.url) {
        return { className: 'mobile-note--link', icon: 'bi bi-link-45deg', label: 'Link' };
    }
    return { className: 'mobile-note--text', icon: 'bi bi-journal-text', label: 'Note' };
}

// MatchesMobileSearch checks the note fields used by the instant mobile filter.
export function MatchesMobileSearch(note: NoteData, value: string): boolean {
    const terms = value.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
        return true;
    }

    const searchable = [note.title, note.body, note.url, note.source, note.author, ...(note.tags || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return terms.every((term) => searchable.includes(term));
}

// CountMobileTags orders tag counts by frequency and then name.
export function CountMobileTags(notes: NoteData[]): Array<[string, number]> {
    const counts = new Map<string, number>();
    notes.forEach((note) => {
        (note.tags || []).forEach((tag) => {
            const normalized = tag.trim();
            if (normalized) {
                counts.set(normalized, (counts.get(normalized) || 0) + 1);
            }
        });
    });

    return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

// FormatMobileTimestamp returns a short date suitable for feed metadata.
export function FormatMobileTimestamp(value?: TimestampValue): string {
    const date = ParseTimestamp(value);
    if (!date) {
        return '';
    }

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    }).format(date);
}

// ParseTimestamp normalizes RFC3339 and protobuf JSON timestamps.
function ParseTimestamp(value?: TimestampValue): Date | null {
    if (!value) {
        return null;
    }

    const date = typeof value === 'string'
        ? new Date(value)
        : new Date((Number(value.seconds || 0) * 1000) + Math.floor(Number(value.nanos || 0) / 1_000_000));
    return Number.isNaN(date.getTime()) ? null : date;
}
