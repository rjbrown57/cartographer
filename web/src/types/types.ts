import * as dropdown from   '../components/dropDown.js';
import * as cards from '../cards/cards.js';
import { Link } from '../cards/links.js';
import { SearchBar } from '../components/searchBar.js';
import * as cache from '../components/cache.js';
import * as query from '../query/query.js';

const EncodingHeader = {
    headers: {
        'Accept-Encoding': 'gzip'
    }
}

let CartographerData: CartoResponse;
let GroupData: CartoResponse;

const GroupEndpoint = query.GetEndpoint + '/groups';
const GroupId = 'groupList'
const buttonId = 'groupButton'

export type CartoResponse = {
    links: LinkData[];
    groups: string[];
}

export type LinkData = {
    id: string;
    displayname: string;
    url: string;
    description: string;
    tags: string[];
    data?: Record<string, any>;
}

// Cartographer class is used to represent a collection of cards
// move to it's own file
export class Cartographer {
    Cards: cards.Card[] = [];
    SearchBar: SearchBar;
    constructor() {
        GetGroups().then(() => {
            PopulateDropDown(GroupData, GroupId);
        }, (err) => {
            console.error(err);
        });
        QueryMainData().then(() => {
            CartographerData.links.forEach((link) => {
                // If the link has a url, we will add it to the cards
                if (link.url) {
                    this.Cards.push(
                        new Link(link.id, 
                            link.displayname, 
                            link.url, 
                            link.description, 
                            link.tags,
                            link.data
                        )
                    );
                }
            });
            this.renderCards();
        }, (err) => {
            console.error(err);
        });
        this.SearchBar = new SearchBar(this.Cards);
    }
    
    showCards(): void {
        this.Cards.forEach((card) => {
            card.log();
        });
    }
    
    renderCards(): void {
        const container = document.getElementById("linkgrid");
        if (!container) {
            console.error("Container element not found");
            return;
        }

        // Check if URL has search parameters (tag, group, or term)
        // If so, show all cards since backend has already filtered
        const urlParams = new URLSearchParams(window.location.search);
        const hasSearchParams = urlParams.has('tag') || urlParams.has('group') || urlParams.has('term');
        
        const INITIAL_CARD_LIMIT = 100;
        const CHUNK_SIZE = 50; // Process cards in chunks of 50 during idle time
        
        // Render and show the first 100 cards immediately
        const initialFragment = document.createDocumentFragment();
        const initialCards = this.Cards.slice(0, INITIAL_CARD_LIMIT);
        
        initialCards.forEach((card) => {
            initialFragment.appendChild(card.render());
        });
        
        // Append first batch immediately - user sees content right away
        container.appendChild(initialFragment);
        
        // If we have more cards and no search params, process the rest in background
        if (this.Cards.length > INITIAL_CARD_LIMIT && !hasSearchParams) {
            const remainingCards = this.Cards.slice(INITIAL_CARD_LIMIT);
            let currentIndex = 0;
            
            // Helper function to process a chunk of cards
            const processChunk = () => {
                const endIndex = Math.min(currentIndex + CHUNK_SIZE, remainingCards.length);
                const chunk = remainingCards.slice(currentIndex, endIndex);
                
                // Render cards in this chunk
                const chunkFragment = document.createDocumentFragment();
                chunk.forEach((card) => {
                    const renderedCard = card.render();
                    card.hide(); // Initially hide, will show when ready
                    chunkFragment.appendChild(renderedCard);
                });
                
                // Append chunk to DOM
                container.appendChild(chunkFragment);
                
                currentIndex = endIndex;
                
                // If there are more cards to process, schedule next chunk
                if (currentIndex < remainingCards.length) {
                    // Use requestIdleCallback if available, otherwise fall back to setTimeout
                    if (window.requestIdleCallback) {
                        window.requestIdleCallback(processChunk, { timeout: 1000 });
                    } else {
                        setTimeout(processChunk, 0);
                    }
                }
            };
            
            // Start processing remaining cards in background
            if (window.requestIdleCallback) {
                window.requestIdleCallback(processChunk, { timeout: 1000 });
            } else {
                setTimeout(processChunk, 0);
            }
        } else if (this.Cards.length > INITIAL_CARD_LIMIT) {
            // If we have search params, render all cards immediately
            const remainingFragment = document.createDocumentFragment();
            const remainingCards = this.Cards.slice(INITIAL_CARD_LIMIT);
            remainingCards.forEach((card) => {
                remainingFragment.appendChild(card.render());
            });
            container.appendChild(remainingFragment);
        }
    }
}    

 // QueryMainData will check the cache for the data and if it's valid, it will use the cached data.
 // If it's not valid, it will fetch the data from the server and cache it.
async function QueryMainData() {
    const queryPath = query.GetQueryPath();
    
    // Check if we have valid cached data for this query path
    console.log('Cache lookup for path:', queryPath, 'Cache size:', cache.getCacheSize(), 'Cache keys:', cache.getCacheKeys());
    const cachedEntry = cache.getCacheEntry(queryPath);
    
    console.log('Cache entry retrieved:', cachedEntry);
    if (cache.isCacheValid(cachedEntry)) {
        // The `!` is TypeScript's non-null assertion operator. It tells TypeScript that `cachedEntry` is definitely not null/undefined
        // at this point, even though `getCacheEntry()` returns `CacheEntry<CartoResponse> | undefined`. We can safely use `!` here because `isCacheValid()` 
        // returns false if the cache entry is null/undefined, so we know it exists when we reach this line.
        CartographerData = cachedEntry!.data;
        console.log('Using cached data:', CartographerData);
        return;
    }

    try {
        const response = await fetch(queryPath, EncodingHeader);
        const data = await response.json();
        CartographerData = data.response;
        
        // Store in cache with timestamp, keyed by query path
        cache.setCacheEntry(queryPath, CartographerData);
        console.log('Cache set for path:', queryPath, 'Cache size:', cache.getCacheSize());
        
        console.log('Fetched and cached data:', CartographerData);
    } catch (err) {
        return console.error(err);
    }
}

async function GetGroups() {
    try {
        const response = await fetch(GroupEndpoint, EncodingHeader);
         const data = await response.json();
         GroupData = data.response;
     } catch (err) {
         return console.error(err);
     }
 }

function PopulateDropDown(data: CartoResponse, elementTarget: string) {
    
    const button = document.getElementById(buttonId) as HTMLElement;
    button.onclick = function() {
        dropdown.ToggleDropdown('groupdropdown');
    };

    const dropDown = document.getElementById(elementTarget) as HTMLElement;

    for (const item of data.groups) {
        console.log('Adding to group dropdown' + item);
        dropdown.AddDropDownElement(dropDown, '/?group=' + item, item);
    };
}