export type NoteSortMode = 'smart' | 'title-asc' | 'title-desc';

export type SortableTimestamp = string | {
    seconds?: number | string;
    nanos?: number;
};

export type SortableNote = {
    id?: string;
    title?: string;
    url?: string;
    created_at?: SortableTimestamp;
    updated_at?: SortableTimestamp;
};

export type NoteSortOption = {
    id: NoteSortMode;
    label: string;
    summary: string;
};

export const NoteSortOptions: NoteSortOption[] = [
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
const DefaultNoteSortMode: NoteSortMode = 'smart';
const NoteSortModes = new Set<NoteSortMode>(NoteSortOptions.map(option => option.id));
const TitleCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// IsNoteSortMode reports whether a string is an allowed note sort mode.
export function IsNoteSortMode(value: string): value is NoteSortMode {
    return NoteSortModes.has(value as NoteSortMode);
}

// GetNoteSortMode reads and validates the user's note sort cookie.
export function GetNoteSortMode(cookieHeader: string = document.cookie): NoteSortMode {
    for (const cookie of cookieHeader.split(';')) {
        const [rawName, ...rawValueParts] = cookie.trim().split('=');
        if (rawName !== NoteSortCookieName) {
            continue;
        }

        try {
            const value = decodeURIComponent(rawValueParts.join('='));
            return IsNoteSortMode(value) ? value : DefaultNoteSortMode;
        } catch {
            return DefaultNoteSortMode;
        }
    }

    return DefaultNoteSortMode;
}

// SetNoteSortMode persists a validated note sort mode for one year.
export function SetNoteSortMode(mode: NoteSortMode): void {
    const safeMode = IsNoteSortMode(mode) ? mode : DefaultNoteSortMode;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${NoteSortCookieName}=${encodeURIComponent(safeMode)}; Path=/; Max-Age=${NoteSortCookieAge}; SameSite=Lax${secure}`;
}

// SortNotes returns a sorted copy without changing cached response data.
export function SortNotes<T extends SortableNote>(notes: T[], mode: NoteSortMode, hasTermSearch: boolean): T[] {
    const sorted = notes.slice();

    // Search results already arrive in relevance order from Bleve.
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

// CompareNoteDates orders recently updated notes first and keeps missing dates last.
function CompareNoteDates(left: SortableNote, right: SortableNote): number {
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

// GetNoteDate resolves updated time first and falls back to creation time.
function GetNoteDate(note: SortableNote): number | null {
    return GetTimestampMilliseconds(note.updated_at) ?? GetTimestampMilliseconds(note.created_at);
}

// GetTimestampMilliseconds normalizes RFC3339 and protobuf JSON timestamp values.
function GetTimestampMilliseconds(value?: SortableTimestamp): number | null {
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

// CompareNoteTitles provides deterministic, numeric-aware title and ID ordering.
function CompareNoteTitles(left: SortableNote, right: SortableNote): number {
    const titleComparison = TitleCollator.compare(GetNoteTitle(left), GetNoteTitle(right));
    if (titleComparison !== 0) {
        return titleComparison;
    }

    return TitleCollator.compare(GetNoteID(left), GetNoteID(right));
}

// GetNoteTitle mirrors the fallback title displayed by note cards.
function GetNoteTitle(note: SortableNote): string {
    return note.title || note.url || note.id || '';
}

// GetNoteID returns the stable note key used to break otherwise equal comparisons.
function GetNoteID(note: SortableNote): string {
    return note.id || note.url || note.title || '';
}
