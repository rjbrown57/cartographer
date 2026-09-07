import type { AdminSession, CartographerData, NoteData } from './types.js';

type DataEnvelope = {
    response?: CartographerData;
};

type NamespaceEnvelope = {
    response?: {
        msg?: string[];
    };
};

const NamespaceStorageKey = 'cartographer_selected_namespace';

// GetSelectedNamespace resolves namespace state from the URL, browser preference, or default.
export function GetSelectedNamespace(search: string = window.location.search): string {
    const fromURL = new URLSearchParams(search).get('namespace')?.trim();
    if (fromURL) {
        return fromURL;
    }

    return localStorage.getItem(NamespaceStorageKey)?.trim() || 'default';
}

// SetSelectedNamespace remembers the current namespace across desktop and mobile views.
export function SetSelectedNamespace(namespace: string): void {
    localStorage.setItem(NamespaceStorageKey, namespace);
}

// BuildNotesPath creates a backend query while preserving supported note filters.
export function BuildNotesPath(namespace: string, search: string = window.location.search): string {
    const incoming = new URLSearchParams(search);
    const outgoing = new URLSearchParams();
    incoming.getAll('tag').forEach((tag) => outgoing.append('tag', tag));
    incoming.getAll('term').forEach((term) => outgoing.append('term', term));
    outgoing.set('namespace', namespace);
    return `/v1/get?${outgoing.toString()}`;
}

// FetchNotes loads notes for one namespace and the active URL filters.
export async function FetchNotes(namespace: string, search: string = window.location.search): Promise<NoteData[]> {
    const response = await fetch(BuildNotesPath(namespace, search), {
        headers: { 'Accept-Encoding': 'gzip' },
    });
    if (!response.ok) {
        throw new Error(`Unable to load notes: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as DataEnvelope;
    return Array.isArray(payload.response?.notes) ? payload.response.notes : [];
}

// FetchNamespaces loads the available namespace names.
export async function FetchNamespaces(): Promise<string[]> {
    const response = await fetch('/v1/get/namespaces', {
        headers: { 'Accept-Encoding': 'gzip' },
    });
    if (!response.ok) {
        throw new Error(`Unable to load namespaces: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as NamespaceEnvelope;
    return Array.isArray(payload.response?.msg) ? payload.response.msg : [];
}

// FetchAdminSession reports whether mobile authoring actions should be available.
export async function FetchAdminSession(): Promise<AdminSession> {
    const response = await fetch('/v1/admin/session', {
        headers: { 'Accept-Encoding': 'gzip' },
    });
    if (!response.ok) {
        return { admin: false, configured: false };
    }

    return await response.json() as AdminSession;
}
