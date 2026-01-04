import * as dropdown from   '../components/dropDown.js';
import * as cards from '../cards/cards.js';
import { Link } from '../cards/links.js';
import { SearchBar, TagFilter } from '../components/searchBar.js';
import * as cache from '../components/cache.js';
import { getListViewPreference, setListViewPreference } from '../components/uiOptions.js';
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
    // Initialize data, build cards, and wire up UI controls.
    constructor() {
        GetGroups().then(() => {
            PopulateDropDown(GroupData, GroupId);
        }, (err) => {
            console.error(err);
        });
        QueryMainData().then(() => {
            if (!CartographerData || !Array.isArray(CartographerData.links)) {
                console.error('No links data available to render');
                RenderNavMetadata([]);
                return;
            }
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
            RenderNavMetadata(this.Cards);
            this.renderCards();
        }, (err) => {
            console.error(err);
        });
        this.SearchBar = new SearchBar(this.Cards);
        SetupViewToggle();
    }
    
    // Log each card to the console for quick inspection.
    showCards(): void {
        this.Cards.forEach((card) => {
            card.log();
        });
    }
    
    // Render cards into the grid with chunked loading for large sets.
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
            
            // Render the next chunk of cards and schedule remaining work.
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

// Fetch main data with cache validation and update the global store.
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
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
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

// Build the nav metadata row summarizing tags for the current cards list.
function RenderNavMetadata(cardsList: cards.Card[]) {
    // Locate the metadata row, tag container, and site name elements.
    const metaRow = document.getElementById('navMetaRow');
    const tagsContainer = document.getElementById('navMetaTags');
    const siteName = document.getElementById('siteName');

    // Bail if required DOM nodes are missing.
    if (!metaRow || !tagsContainer) {
        return;
    }

    // Hide the metadata row when there are no cards to summarize.
    if (!cardsList || cardsList.length === 0) {
        metaRow.classList.add('is-hidden');
        return;
    }

    // Count tag occurrences across all cards.
    const tagFrequency = new Map<string, number>();
    cardsList.forEach(card => {
        if (!card.tags) {
            return;
        }
        card.tags.forEach(tag => {
            const normalized = tag.trim();
            if (normalized === '') {
                return;
            }
            tagFrequency.set(normalized, (tagFrequency.get(normalized) || 0) + 1);
        });
    });

    if (siteName) {
        siteName.setAttribute('title', `${cardsList.length} links \u2022 ${tagFrequency.size} tags`);
    }
    // Reset and rebuild the tags area.
    tagsContainer.innerHTML = '';

    // Add a leading icon/label for the tags list.
    const icon = document.createElement('i');
    icon.className = 'bi bi-tags nav-meta__icon';
    const label = document.createElement('span');
    label.className = 'nav-meta__label';
    label.textContent = 'Top tags';
    tagsContainer.appendChild(icon);
    tagsContainer.appendChild(label);

    // Pick the top tags by count (then name), limited to 10.
    const topTags = [...tagFrequency.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10);

    // Render empty state if there are no tags.
    if (topTags.length === 0) {
        const emptyState = document.createElement('span');
        emptyState.className = 'text-secondary small';
        emptyState.textContent = 'No tags available yet';
        tagsContainer.appendChild(emptyState);
    }

    // Render each top tag as a button that filters by that tag.
    topTags.forEach(([tag, count]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'nav-tag';

        const tagText = document.createElement('span');
        tagText.textContent = tag;

        const badge = document.createElement('span');
        badge.className = 'nav-tag__count';
        badge.textContent = `(${count})`;

        button.appendChild(tagText);
        button.appendChild(badge);
        button.addEventListener('click', () => TagFilter(tag));

        tagsContainer.appendChild(button);
    });

    // Ensure the metadata row is visible once populated.
    metaRow.classList.remove('is-hidden');
}

// Wire up the list/grid view toggle and persist user preference.
function SetupViewToggle(): void {
    // Find the toggle button and elements that change layout visibility.
    const toggle = document.getElementById('viewToggle') as HTMLButtonElement | null;
    const grid = document.getElementById('linkgrid');
    const header = document.getElementById('listHeader');

    // Exit early if required DOM elements are missing.
    if (!toggle || !grid) {
        return;
    }

    // Apply list/grid classes, header visibility, and button state.
    const updateToggle = (isListView: boolean) => {
        grid.classList.toggle('list-view', isListView);
        header?.classList.toggle('is-hidden', !isListView);
        toggle.setAttribute('aria-pressed', String(isListView));
        toggle.setAttribute('aria-label', isListView ? 'Switch to grid view' : 'Switch to list view');
        toggle.innerHTML = isListView
            ? '<i class="bi bi-grid-3x3-gap"></i><span class="visually-hidden">Grid view</span>'
            : '<i class="bi bi-list"></i><span class="visually-hidden">List view</span>';
    };

    // Default to grid view unless cached preference exists.
    updateToggle(getListViewPreference());

    // Flip the view on button click.
    toggle.addEventListener('click', () => {
        const isListView = !grid.classList.contains('list-view');
        updateToggle(isListView);
        setListViewPreference(isListView);
    });
}

// Fetch available groups for the dropdown.
async function GetGroups() {
    try {
        const response = await fetch(GroupEndpoint, EncodingHeader);
         const data = await response.json();
         GroupData = data.response;
     } catch (err) {
         return console.error(err);
     }
 }

// Populate the group dropdown with links from the response data.
function PopulateDropDown(data: CartoResponse, elementTarget: string) {
    
    const button = document.getElementById(buttonId) as HTMLElement;
    // Toggle the dropdown when the button is clicked.
    button.onclick = function() {
        dropdown.ToggleDropdown('groupdropdown', buttonId);
    };

    const dropDown = document.getElementById(elementTarget) as HTMLElement;

    for (const item of data.groups) {
        console.log('Adding to group dropdown' + item);
        dropdown.AddDropDownElement(dropDown, '/?group=' + item, item);
    };
}
