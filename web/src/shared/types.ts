export type TimestampValue = string | {
    seconds?: number | string;
    nanos?: number;
};

export type NoteData = {
    id: string;
    title: string;
    url: string;
    body: string;
    tags: string[];
    data?: Record<string, unknown>;
    created_at?: TimestampValue;
    updated_at?: TimestampValue;
    source?: string;
    author?: string;
    version?: number;
};

export type CartographerData = {
    notes: NoteData[];
};

export type AdminSession = {
    admin: boolean;
    configured: boolean;
};
