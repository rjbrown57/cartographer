import * as cache from '../components/cache.js';

export const GetEndpoint = '/v1/get';
const NamespaceStorageKey = 'cartographer_selected_namespace';
const DefaultNamespace = 'default';

// GetSelectedNamespace returns the effective namespace using URL first, then localStorage, then default.
export function GetSelectedNamespace(): string {
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

// SetSelectedNamespace stores the user-selected namespace as the default for future requests.
export function SetSelectedNamespace(namespace: string): void {
    localStorage.setItem(NamespaceStorageKey, namespace);
}

// IsDefaultNamespace returns true when the provided namespace matches the UI default namespace.
export function IsDefaultNamespace(namespace: string): boolean {
    return namespace === DefaultNamespace;
}

// GetQueryPath builds the data request path and includes the selected namespace in query params.
export function GetQueryPath(): string {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParams = new URLSearchParams();
    const namespace = GetSelectedNamespace();
    // get the tags from the url params
    // example: http://localhost:8081/v1/get/?tag=docker
    const tag = urlParams.getAll('tag');
    // get the terms from the url params
    // example: http://localhost:8081/v1/get/?term=docker
    const term = urlParams.getAll('term');
    // invalidate the cache by clearing the in-memory cache and saving to localStorage
    // example: http://localhost:8081/v1/get/?cache=false
    const invalidate = urlParams.get('cache');
    
    // http://localhost:8081/v1/get/?tag=oci&tag=github
    tag.forEach((t) => {
        queryParams.append('tag', t);
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
