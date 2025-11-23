import * as cache from '../components/cache.js';

export const GetEndpoint = '/v1/get';

export function GetQueryPath(): string {
    let queryUrl = GetEndpoint;
     const urlParams = new URLSearchParams(window.location.search);
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
     if (tag.length > 0) {
        queryUrl += "?tag=" + tag[0];
        // add the rest of the tags as query params
        tag.slice(1).forEach((t) => {
            queryUrl += "&tag=" + t;
        });
     }

     if (group.length > 0) {
        queryUrl += "?group=" + group[0];
        // add the rest of the groups as query params
        group.slice(1).forEach((g) => {
            queryUrl += "&group=" + g;
        });
     }

     if (term.length > 0) {
        queryUrl += "?term=" + term[0];
        // add the rest of the terms as query params
        term.slice(1).forEach((t) => {
            queryUrl += "&term=" + t;
        });
     }

     if (invalidate) {
        cache.invalidateCache();
     }

     console.log('Query path:', queryUrl);

     return queryUrl
 }