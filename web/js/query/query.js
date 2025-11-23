import * as cache from '../components/cache.js';
export const GetEndpoint = '/v1/get';
export function GetQueryPath() {
    let queryUrl = GetEndpoint;
    const urlParams = new URLSearchParams(window.location.search);
    const tag = urlParams.getAll('tag');
    const group = urlParams.getAll('group');
    const term = urlParams.getAll('term');
    const invalidate = urlParams.get('cache');
    if (tag.length > 0) {
        queryUrl += "?tag=" + tag[0];
        tag.slice(1).forEach((t) => {
            queryUrl += "&tag=" + t;
        });
    }
    if (group.length > 0) {
        queryUrl += "?group=" + group[0];
        group.slice(1).forEach((g) => {
            queryUrl += "&group=" + g;
        });
    }
    if (term.length > 0) {
        queryUrl += "?term=" + term[0];
        term.slice(1).forEach((t) => {
            queryUrl += "&term=" + t;
        });
    }
    if (invalidate) {
        cache.invalidateCache();
    }
    console.log('Query path:', queryUrl);
    return queryUrl;
}
