import * as cache from '../components/cache.js';

export const GetEndpoint = '/v1/get';

export function GetQueryPath(): string {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParams = new URLSearchParams();
    // get the tags from the url params
    // example: http://localhost:8081/v1/get/?tag=docker
    const tag = urlParams.getAll('tag');
    // get the groups from the url params
    // example: http://localhost:8081/v1/get/?group=docker
    const group = urlParams.getAll('group');
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

    group.forEach((g) => {
        queryParams.append('group', g);
    });

    term.forEach((t) => {
        queryParams.append('term', t);
    });

    if (invalidate) {
        cache.invalidateCache();
    }

    const queryString = queryParams.toString();
    const queryUrl = queryString ? `${GetEndpoint}?${queryString}` : GetEndpoint;

    console.log('Query path:', queryUrl);

    return queryUrl;
}
