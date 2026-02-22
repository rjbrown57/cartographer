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

const NamespaceEndpoint = query.GetEndpoint + '/namespaces';
const NamespaceListId = 'namespaceList'
const NamespaceButtonId = 'namespaceButton'
const NamespaceButtonLabelId = 'namespaceButtonLabel'
const NamespaceDropdownId = 'namespacedropdown'

export type CartoResponse = {
    links: LinkData[];
}

export type NamespaceResponse = {
    msg: string[];
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
        this.SearchBar = new SearchBar(this.Cards);
        SetupViewToggle();
        this.Initialize();
    }

    // Initialize prepares namespace state, loads backend data, and then renders cards.
    private async Initialize(): Promise<void> {
        await SetupNamespaceSelector();

        await QueryMainData();

        if (!CartographerData || !Array.isArray(CartographerData.links)) {
            console.error('No links data available to render');
            RenderNavMetadata([]);
            return;
        }

        CartographerData.links.forEach((link) => {
            // Normalize link fields so namespaces that store key-only records
            // (id without url/displayname) still render usable cards.
            const resolvedURL = link.url || link.id;
            if (!resolvedURL) {
                return;
            }

            const resolvedDisplayName = link.displayname || resolvedURL;
            const resolvedDescription = link.description || '';
            const resolvedTags = Array.isArray(link.tags) ? link.tags : [];
            const resolvedID = link.id || resolvedURL;

            this.Cards.push(
                new Link(
                    resolvedID,
                    resolvedDisplayName,
                    resolvedURL,
                    resolvedDescription,
                    resolvedTags,
                    link.data
                )
            );
        });

        RenderNavMetadata(this.Cards);
        this.renderCards();
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

        // Check if URL has search parameters (tag or term)
        // If so, show all cards since backend has already filtered
        const urlParams = new URLSearchParams(window.location.search);
        const hasSearchParams = urlParams.has('tag') || urlParams.has('term');
        
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

// GetNamespacesEndpoint builds the endpoint used to fetch currently active namespace names.
function GetNamespacesEndpoint(): string {
    return NamespaceEndpoint;
}

// SetupNamespaceSelector loads namespaces, applies cached/default selection, and reacts to user changes.
async function SetupNamespaceSelector(): Promise<void> {
    const namespaceButton = document.getElementById(NamespaceButtonId) as HTMLElement | null;
    const namespaceLabel = document.getElementById(NamespaceButtonLabelId) as HTMLElement | null;
    const namespaceList = document.getElementById(NamespaceListId) as HTMLElement | null;
    if (!namespaceButton || !namespaceLabel || !namespaceList) {
        return;
    }

    const availableNamespaces = await GetNamespaces();
    const currentNamespace = query.GetSelectedNamespace();

    if (availableNamespaces.length === 0) {
        availableNamespaces.push(currentNamespace);
    }

    if (!availableNamespaces.includes(currentNamespace)) {
        availableNamespaces.push(currentNamespace);
    }

    availableNamespaces.sort((a, b) => a.localeCompare(b));
    namespaceLabel.textContent = currentNamespace;

    query.SetSelectedNamespace(currentNamespace);

    const url = new URL(window.location.href);
    const namespaceParam = url.searchParams.get('namespace');
    if (!namespaceParam && !query.IsDefaultNamespace(currentNamespace)) {
        url.searchParams.set('namespace', currentNamespace);
        window.history.replaceState({}, '', url.toString());
    } else if (namespaceParam && query.IsDefaultNamespace(currentNamespace)) {
        // Keep the URL clean by removing explicit default namespace.
        url.searchParams.delete('namespace');
        window.history.replaceState({}, '', url.toString());
    }

    namespaceButton.onclick = function() {
        dropdown.ToggleDropdown(NamespaceDropdownId, NamespaceButtonId);
    };

    namespaceList.innerHTML = '';
    availableNamespaces.forEach((namespace) => {
        const nextURL = new URL(window.location.href);
        // Namespace switches should start from a clean filter state.
        nextURL.searchParams.delete('tag');
        nextURL.searchParams.delete('term');
        if (query.IsDefaultNamespace(namespace)) {
            nextURL.searchParams.delete('namespace');
        } else {
            nextURL.searchParams.set('namespace', namespace);
        }

        const entry = document.createElement('div');
        const link = document.createElement('a');
        link.className = 'dropdown-item-link';
        link.href = nextURL.toString();
        link.textContent = namespace;
        link.onclick = (event) => {
            event.preventDefault();
            query.SetSelectedNamespace(namespace);
            window.location.assign(nextURL.toString());
        };
        entry.appendChild(link);
        namespaceList.appendChild(entry);
    });
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
    const SKELETON_CLASS = 'nav-meta--loading';
    const ENTER_CLASS = 'nav-meta--enter';
    const SKELETON_COUNT = 6;

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

    // Build selected tag filter set so nav bubbles can reflect current selection state.
    const selectedTags = new Set(
        new URLSearchParams(window.location.search)
            .getAll('tag')
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag !== '')
    );

    const searchElement = document.getElementById('searchBar') as HTMLInputElement | null;
    if (searchElement && searchElement.value.trim() !== '') {
        searchElement.value
            .split(' ')
            .map((term) => term.trim().toLowerCase())
            .filter((term) => term !== '')
            .forEach((term) => selectedTags.add(term));
    }
    // Helper to reset and rebuild the tags area with the base icon/label.
    const buildBase = (container: HTMLElement, iconClass: string, labelText: string) => {
        container.innerHTML = '';
        const icon = document.createElement('i');
        icon.className = `${iconClass} nav-meta__icon`;
        const label = document.createElement('span');
        label.className = 'nav-meta__label';
        label.textContent = labelText;
        container.appendChild(icon);
        container.appendChild(label);
        return { icon, label };
    };

    // When no data yet, show a lightweight skeleton state instead of popping in.
    if (!cardsList || cardsList.length === 0) {
        buildBase(tagsContainer, 'bi bi-tags', 'Top tags');
        for (let i = 0; i < SKELETON_COUNT; i++) {
            const skeleton = document.createElement('span');
            skeleton.className = 'nav-tag nav-tag--skeleton';
            tagsContainer.appendChild(skeleton);
        }
        metaRow.classList.remove('is-hidden');
        metaRow.classList.add(SKELETON_CLASS);
        metaRow.classList.remove(ENTER_CLASS);
        return;
    }

    buildBase(tagsContainer, 'bi bi-tags', 'Top tags');

    // Pick the top tags by count (then name).
    const topTags = [...tagFrequency.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    // Render empty state if there are no tags.
    if (topTags.length === 0) {
        const emptyState = document.createElement('span');
        emptyState.className = 'text-secondary small';
        emptyState.textContent = 'No tags available yet';
        tagsContainer.appendChild(emptyState);
    }

    // Render each top tag as a button that filters by that tag.
    const renderTagButton = (tag: string, count: number) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'nav-tag';
        if (selectedTags.has(tag.toLowerCase())) {
            button.classList.add('nav-tag--active');
        }

        const tagText = document.createElement('span');
        tagText.className = 'nav-tag__text';
        tagText.textContent = tag;
        tagText.title = tag;

        const badge = document.createElement('span');
        badge.className = 'nav-tag__count';
        badge.textContent = `(${count})`;

        button.appendChild(tagText);
        button.appendChild(badge);
        button.addEventListener('click', () => {
            TagFilter(tag);
            // Re-render metadata so selected-state styling tracks tag toggle actions.
            RenderNavMetadata(cardsList);
        });

        tagsContainer.appendChild(button);
    };

    topTags.forEach(([tag, count]) => renderTagButton(tag, count));

    // Ensure the metadata row is visible once populated and animate it in.
    metaRow.classList.remove('is-hidden');
    metaRow.classList.remove(SKELETON_CLASS);
    metaRow.classList.add(ENTER_CLASS);
    requestAnimationFrame(() => {
        metaRow.classList.remove(ENTER_CLASS);
    });
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

// GetNamespaces fetches namespaces from the backend response message list.
async function GetNamespaces(): Promise<string[]> {
    try {
        const response = await fetch(GetNamespacesEndpoint(), EncodingHeader);
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const responseData = data?.response as NamespaceResponse | undefined;
        if (!responseData || !Array.isArray(responseData.msg)) {
            return [];
        }
        return responseData.msg;
    } catch (err) {
        console.error(err);
        return [];
    }
}
