import * as cache from '../components/cache.js';
export const GetEndpoint = '/v1/get';
export function GetQueryPath() {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParams = new URLSearchParams();
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
    if (invalidate) {
        cache.invalidateCache();
    }
    const queryString = queryParams.toString();
    const queryUrl = queryString ? `${GetEndpoint}?${queryString}` : GetEndpoint;
    console.log('Query path:', queryUrl);
    return queryUrl;
}
