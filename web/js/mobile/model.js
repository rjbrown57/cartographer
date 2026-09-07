export function GetMobileNoteType(note) {
    if (note.data && Object.keys(note.data).length > 0) {
        return { className: 'mobile-note--data', icon: 'bi bi-braces', label: 'Data' };
    }
    if (note.url) {
        return { className: 'mobile-note--link', icon: 'bi bi-link-45deg', label: 'Link' };
    }
    return { className: 'mobile-note--text', icon: 'bi bi-journal-text', label: 'Note' };
}
export function MatchesMobileSearch(note, value) {
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
export function CountMobileTags(notes) {
    const counts = new Map();
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
export function FormatMobileTimestamp(value) {
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
function ParseTimestamp(value) {
    if (!value) {
        return null;
    }
    const date = typeof value === 'string'
        ? new Date(value)
        : new Date((Number(value.seconds || 0) * 1000) + Math.floor(Number(value.nanos || 0) / 1_000_000));
    return Number.isNaN(date.getTime()) ? null : date;
}
