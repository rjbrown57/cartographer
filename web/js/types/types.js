import * as dropdown from '../components/dropDown.js';
import { Link } from '../cards/links.js';
import { SearchBar, TagFilter } from '../components/searchBar.js';
import * as cache from '../components/cache.js';
import { getListViewPreference, setListViewPreference } from '../components/uiOptions.js';
import * as query from '../query/query.js';
const EncodingHeader = {
    headers: {
        'Accept-Encoding': 'gzip'
    }
};
let CartographerData;
let GroupData;
const NamespaceEndpoint = query.GetEndpoint + '/namespaces';
const NamespaceListId = 'namespaceList';
const NamespaceButtonId = 'namespaceButton';
const NamespaceButtonLabelId = 'namespaceButtonLabel';
const NamespaceDropdownId = 'namespacedropdown';
export class Cartographer {
    Cards = [];
    SearchBar;
    constructor() {
        this.SearchBar = new SearchBar(this.Cards);
        SetupViewToggle();
        this.Initialize();
    }
    async Initialize() {
        await SetupNamespaceSelector();
        await Promise.all([GetGroups(), QueryMainData()]);
        if (!CartographerData || !Array.isArray(CartographerData.links)) {
            console.error('No links data available to render');
            RenderNavMetadata([]);
            return;
        }
        CartographerData.links.forEach((link) => {
            const resolvedURL = link.url || link.id;
            if (!resolvedURL) {
                return;
            }
            const resolvedDisplayName = link.displayname || resolvedURL;
            const resolvedDescription = link.description || '';
            const resolvedTags = Array.isArray(link.tags) ? link.tags : [];
            const resolvedID = link.id || resolvedURL;
            this.Cards.push(new Link(resolvedID, resolvedDisplayName, resolvedURL, resolvedDescription, resolvedTags, link.data));
        });
        RenderNavMetadata(this.Cards);
        this.renderCards();
    }
    showCards() {
        this.Cards.forEach((card) => {
            card.log();
        });
    }
    renderCards() {
        const container = document.getElementById("linkgrid");
        if (!container) {
            console.error("Container element not found");
            return;
        }
        const urlParams = new URLSearchParams(window.location.search);
        const hasSearchParams = urlParams.has('tag') || urlParams.has('group') || urlParams.has('term');
        const INITIAL_CARD_LIMIT = 100;
        const CHUNK_SIZE = 50;
        const initialFragment = document.createDocumentFragment();
        const initialCards = this.Cards.slice(0, INITIAL_CARD_LIMIT);
        initialCards.forEach((card) => {
            initialFragment.appendChild(card.render());
        });
        container.appendChild(initialFragment);
        if (this.Cards.length > INITIAL_CARD_LIMIT && !hasSearchParams) {
            const remainingCards = this.Cards.slice(INITIAL_CARD_LIMIT);
            let currentIndex = 0;
            const processChunk = () => {
                const endIndex = Math.min(currentIndex + CHUNK_SIZE, remainingCards.length);
                const chunk = remainingCards.slice(currentIndex, endIndex);
                const chunkFragment = document.createDocumentFragment();
                chunk.forEach((card) => {
                    const renderedCard = card.render();
                    card.hide();
                    chunkFragment.appendChild(renderedCard);
                });
                container.appendChild(chunkFragment);
                currentIndex = endIndex;
                if (currentIndex < remainingCards.length) {
                    if (window.requestIdleCallback) {
                        window.requestIdleCallback(processChunk, { timeout: 1000 });
                    }
                    else {
                        setTimeout(processChunk, 0);
                    }
                }
            };
            if (window.requestIdleCallback) {
                window.requestIdleCallback(processChunk, { timeout: 1000 });
            }
            else {
                setTimeout(processChunk, 0);
            }
        }
        else if (this.Cards.length > INITIAL_CARD_LIMIT) {
            const remainingFragment = document.createDocumentFragment();
            const remainingCards = this.Cards.slice(INITIAL_CARD_LIMIT);
            remainingCards.forEach((card) => {
                remainingFragment.appendChild(card.render());
            });
            container.appendChild(remainingFragment);
        }
    }
}
function GetGroupsEndpoint() {
    const params = new URLSearchParams();
    params.set('namespace', query.GetSelectedNamespace());
    return `${query.GetEndpoint}/groups?${params.toString()}`;
}
function GetNamespacesEndpoint() {
    return NamespaceEndpoint;
}
function BuildRootURLWithParams(params) {
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.search = '';
    const namespace = query.GetSelectedNamespace();
    if (!query.IsDefaultNamespace(namespace)) {
        url.searchParams.set('namespace', namespace);
    }
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });
    return `${url.pathname}${url.search}`;
}
async function SetupNamespaceSelector() {
    const namespaceButton = document.getElementById(NamespaceButtonId);
    const namespaceLabel = document.getElementById(NamespaceButtonLabelId);
    const namespaceList = document.getElementById(NamespaceListId);
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
    }
    else if (namespaceParam && query.IsDefaultNamespace(currentNamespace)) {
        url.searchParams.delete('namespace');
        window.history.replaceState({}, '', url.toString());
    }
    namespaceButton.onclick = function () {
        dropdown.ToggleDropdown(NamespaceDropdownId, NamespaceButtonId);
    };
    namespaceList.innerHTML = '';
    availableNamespaces.forEach((namespace) => {
        const nextURL = new URL(window.location.href);
        nextURL.searchParams.delete('tag');
        nextURL.searchParams.delete('group');
        nextURL.searchParams.delete('term');
        if (query.IsDefaultNamespace(namespace)) {
            nextURL.searchParams.delete('namespace');
        }
        else {
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
async function QueryMainData() {
    const queryPath = query.GetQueryPath();
    console.log('Cache lookup for path:', queryPath, 'Cache size:', cache.getCacheSize(), 'Cache keys:', cache.getCacheKeys());
    const cachedEntry = cache.getCacheEntry(queryPath);
    console.log('Cache entry retrieved:', cachedEntry);
    if (cache.isCacheValid(cachedEntry)) {
        CartographerData = cachedEntry.data;
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
        cache.setCacheEntry(queryPath, CartographerData);
        console.log('Cache set for path:', queryPath, 'Cache size:', cache.getCacheSize());
        console.log('Fetched and cached data:', CartographerData);
    }
    catch (err) {
        return console.error(err);
    }
}
function RenderNavMetadata(cardsList) {
    const metaRow = document.getElementById('navMetaRow');
    const groupsContainer = document.getElementById('navMetaGroups');
    const tagsContainer = document.getElementById('navMetaTags');
    const siteName = document.getElementById('siteName');
    const SKELETON_CLASS = 'nav-meta--loading';
    const ENTER_CLASS = 'nav-meta--enter';
    const SKELETON_COUNT = 6;
    if (!metaRow || !tagsContainer || !groupsContainer) {
        return;
    }
    if (!cardsList || cardsList.length === 0) {
        metaRow.classList.add('is-hidden');
        return;
    }
    const tagFrequency = new Map();
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
    const selectedGroups = new Set(new URLSearchParams(window.location.search)
        .getAll('group')
        .map((group) => group.trim().toLowerCase())
        .filter((group) => group !== ''));
    const selectedTags = new Set(new URLSearchParams(window.location.search)
        .getAll('tag')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag !== ''));
    const searchElement = document.getElementById('searchBar');
    if (searchElement && searchElement.value.trim() !== '') {
        searchElement.value
            .split(' ')
            .map((term) => term.trim().toLowerCase())
            .filter((term) => term !== '')
            .forEach((term) => selectedTags.add(term));
    }
    const buildBase = (container, iconClass, labelText) => {
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
    if (!cardsList || cardsList.length === 0) {
        buildBase(groupsContainer, 'bi bi-grid', 'Groups');
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
    buildBase(groupsContainer, 'bi bi-grid', 'Groups');
    buildBase(tagsContainer, 'bi bi-tags', 'Top tags');
    const renderGroupButton = (group) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'nav-tag';
        if (selectedGroups.has(group.toLowerCase())) {
            button.classList.add('nav-tag--active');
        }
        const groupText = document.createElement('span');
        groupText.className = 'nav-tag__text';
        groupText.textContent = group;
        groupText.title = group;
        button.appendChild(groupText);
        button.addEventListener('click', () => {
            window.location.assign(BuildRootURLWithParams({ group }));
        });
        groupsContainer.appendChild(button);
    };
    if (GroupData && Array.isArray(GroupData.groups) && GroupData.groups.length > 0) {
        [...GroupData.groups].sort((a, b) => a.localeCompare(b)).forEach((group) => renderGroupButton(group));
    }
    else {
        const emptyGroups = document.createElement('span');
        emptyGroups.className = 'text-secondary small';
        emptyGroups.textContent = 'No groups available';
        groupsContainer.appendChild(emptyGroups);
    }
    const topTags = [...tagFrequency.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (topTags.length === 0) {
        const emptyState = document.createElement('span');
        emptyState.className = 'text-secondary small';
        emptyState.textContent = 'No tags available yet';
        tagsContainer.appendChild(emptyState);
    }
    const renderTagButton = (tag, count) => {
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
            RenderNavMetadata(cardsList);
        });
        tagsContainer.appendChild(button);
    };
    topTags.forEach(([tag, count]) => renderTagButton(tag, count));
    metaRow.classList.remove('is-hidden');
    metaRow.classList.remove(SKELETON_CLASS);
    metaRow.classList.add(ENTER_CLASS);
    requestAnimationFrame(() => {
        metaRow.classList.remove(ENTER_CLASS);
    });
}
function SetupViewToggle() {
    const toggle = document.getElementById('viewToggle');
    const grid = document.getElementById('linkgrid');
    const header = document.getElementById('listHeader');
    if (!toggle || !grid) {
        return;
    }
    const updateToggle = (isListView) => {
        grid.classList.toggle('list-view', isListView);
        header?.classList.toggle('is-hidden', !isListView);
        toggle.setAttribute('aria-pressed', String(isListView));
        toggle.setAttribute('aria-label', isListView ? 'Switch to grid view' : 'Switch to list view');
        toggle.innerHTML = isListView
            ? '<i class="bi bi-grid-3x3-gap"></i><span class="visually-hidden">Grid view</span>'
            : '<i class="bi bi-list"></i><span class="visually-hidden">List view</span>';
    };
    updateToggle(getListViewPreference());
    toggle.addEventListener('click', () => {
        const isListView = !grid.classList.contains('list-view');
        updateToggle(isListView);
        setListViewPreference(isListView);
    });
}
async function GetGroups() {
    try {
        const response = await fetch(GetGroupsEndpoint(), EncodingHeader);
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        GroupData = data.response;
    }
    catch (err) {
        return console.error(err);
    }
}
async function GetNamespaces() {
    try {
        const response = await fetch(GetNamespacesEndpoint(), EncodingHeader);
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const responseData = data?.response;
        if (!responseData || !Array.isArray(responseData.msg)) {
            return [];
        }
        return responseData.msg;
    }
    catch (err) {
        console.error(err);
        return [];
    }
}
