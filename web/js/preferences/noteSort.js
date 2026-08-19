export const NoteSortOptions = [
    {
        id: 'smart',
        label: 'Smart',
        summary: 'Relevant for searches, recently updated otherwise.',
    },
    {
        id: 'title-asc',
        label: 'Title A–Z',
        summary: 'Titles in ascending alphabetical order.',
    },
    {
        id: 'title-desc',
        label: 'Title Z–A',
        summary: 'Titles in descending alphabetical order.',
    },
];
const NoteSortCookieName = 'cartographer_note_sort';
const NoteSortCookieAge = 60 * 60 * 24 * 365;
const DefaultNoteSortMode = 'smart';
const NoteSortModes = new Set(NoteSortOptions.map(option => option.id));
const TitleCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export function IsNoteSortMode(value) {
    return NoteSortModes.has(value);
}
export function GetNoteSortMode(cookieHeader = document.cookie) {
    for (const cookie of cookieHeader.split(';')) {
        const [rawName, ...rawValueParts] = cookie.trim().split('=');
        if (rawName !== NoteSortCookieName) {
            continue;
        }
        try {
            const value = decodeURIComponent(rawValueParts.join('='));
            return IsNoteSortMode(value) ? value : DefaultNoteSortMode;
        }
        catch {
            return DefaultNoteSortMode;
        }
    }
    return DefaultNoteSortMode;
}
export function SetNoteSortMode(mode) {
    const safeMode = IsNoteSortMode(mode) ? mode : DefaultNoteSortMode;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${NoteSortCookieName}=${encodeURIComponent(safeMode)}; Path=/; Max-Age=${NoteSortCookieAge}; SameSite=Lax${secure}`;
}
export function SortNotes(notes, mode, hasTermSearch) {
    const sorted = notes.slice();
    if (mode === 'smart' && hasTermSearch) {
        return sorted;
    }
    sorted.sort((left, right) => {
        if (mode === 'title-asc') {
            return CompareNoteTitles(left, right);
        }
        if (mode === 'title-desc') {
            return CompareNoteTitles(right, left);
        }
        const dateComparison = CompareNoteDates(left, right);
        return dateComparison || CompareNoteTitles(left, right);
    });
    return sorted;
}
function CompareNoteDates(left, right) {
    const leftDate = GetNoteDate(left);
    const rightDate = GetNoteDate(right);
    if (leftDate === null && rightDate === null) {
        return 0;
    }
    if (leftDate === null) {
        return 1;
    }
    if (rightDate === null) {
        return -1;
    }
    return rightDate - leftDate;
}
function GetNoteDate(note) {
    return GetTimestampMilliseconds(note.updated_at) ?? GetTimestampMilliseconds(note.created_at);
}
function GetTimestampMilliseconds(value) {
    if (!value) {
        return null;
    }
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    const seconds = Number(value.seconds);
    const nanos = Number(value.nanos || 0);
    if (!Number.isFinite(seconds) || !Number.isFinite(nanos)) {
        return null;
    }
    return (seconds * 1000) + Math.floor(nanos / 1_000_000);
}
function CompareNoteTitles(left, right) {
    const titleComparison = TitleCollator.compare(GetNoteTitle(left), GetNoteTitle(right));
    if (titleComparison !== 0) {
        return titleComparison;
    }
    return TitleCollator.compare(GetNoteID(left), GetNoteID(right));
}
function GetNoteTitle(note) {
    return note.title || note.url || note.id || '';
}
function GetNoteID(note) {
    return note.id || note.url || note.title || '';
}
