import * as cache from '../components/cache.js';
export const GetEndpoint = '/v1/get';
const NamespaceStorageKey = 'cartographer_selected_namespace';
const DefaultNamespace = 'default';
export function GetSelectedNamespace() {
    const urlParams = new URLSearchParams(window.location.search);
    const namespaceFromURL = urlParams.get('namespace');
    if (namespaceFromURL && namespaceFromURL.trim() !== '') {
        return namespaceFromURL;
    }
    const namespaceFromCache = localStorage.getItem(NamespaceStorageKey);
    if (namespaceFromCache && namespaceFromCache.trim() !== '') {
        return namespaceFromCache;
    }
    return DefaultNamespace;
}
export function SetSelectedNamespace(namespace) {
    localStorage.setItem(NamespaceStorageKey, namespace);
}
export function IsDefaultNamespace(namespace) {
    return namespace === DefaultNamespace;
}
export function GetQueryPath() {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParams = new URLSearchParams();
    const namespace = GetSelectedNamespace();
    const tag = urlParams.getAll('tag');
    const group = urlParams.getAll('group');
    const term = urlParams.getAll('term');
    const invalidate = urlParams.get('cache');
    tag.forEach((t) => {
        queryParams.append('tag', t);
    });
    group.forEach((g) => {
        queryParams.append('group', g);
    });
    term.forEach((t) => {
        queryParams.append('term', t);
    });
    queryParams.set('namespace', namespace);
    if (invalidate) {
        cache.invalidateCache();
    }
    const queryString = queryParams.toString();
    const queryUrl = queryString ? `${GetEndpoint}?${queryString}` : GetEndpoint;
    console.log('Query path:', queryUrl);
    return queryUrl;
}
