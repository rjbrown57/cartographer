const NamespaceStorageKey = 'cartographer_selected_namespace';
export function GetSelectedNamespace(search = window.location.search) {
    const fromURL = new URLSearchParams(search).get('namespace')?.trim();
    if (fromURL) {
        return fromURL;
    }
    return localStorage.getItem(NamespaceStorageKey)?.trim() || 'default';
}
export function SetSelectedNamespace(namespace) {
    localStorage.setItem(NamespaceStorageKey, namespace);
}
export function BuildNotesPath(namespace, search = window.location.search) {
    const incoming = new URLSearchParams(search);
    const outgoing = new URLSearchParams();
    incoming.getAll('tag').forEach((tag) => outgoing.append('tag', tag));
    incoming.getAll('term').forEach((term) => outgoing.append('term', term));
    outgoing.set('namespace', namespace);
    return `/v1/get?${outgoing.toString()}`;
}
export async function FetchNotes(namespace, search = window.location.search) {
    const response = await fetch(BuildNotesPath(namespace, search), {
        headers: { 'Accept-Encoding': 'gzip' },
    });
    if (!response.ok) {
        throw new Error(`Unable to load notes: ${response.status} ${response.statusText}`);
    }
    const payload = await response.json();
    return Array.isArray(payload.response?.notes) ? payload.response.notes : [];
}
export async function FetchNamespaces() {
    const response = await fetch('/v1/get/namespaces', {
        headers: { 'Accept-Encoding': 'gzip' },
    });
    if (!response.ok) {
        throw new Error(`Unable to load namespaces: ${response.status} ${response.statusText}`);
    }
    const payload = await response.json();
    return Array.isArray(payload.response?.msg) ? payload.response.msg : [];
}
export async function FetchAdminSession() {
    const response = await fetch('/v1/admin/session', {
        headers: { 'Accept-Encoding': 'gzip' },
    });
    if (!response.ok) {
        return { admin: false, configured: false };
    }
    return await response.json();
}
