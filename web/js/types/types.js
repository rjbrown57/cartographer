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
const GroupEndpoint = query.GetEndpoint + '/groups';
const GroupId = 'groupList';
const buttonId = 'groupButton';
export class Cartographer {
    Cards = [];
    SearchBar;
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
                if (link.url) {
                    this.Cards.push(new Link(link.id, link.displayname, link.url, link.description, link.tags, link.data));
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
    const tagsContainer = document.getElementById('navMetaTags');
    const siteName = document.getElementById('siteName');
    const SKELETON_CLASS = 'nav-meta--loading';
    const ENTER_CLASS = 'nav-meta--enter';
    const SKELETON_COUNT = 6;
    if (!metaRow || !tagsContainer) {
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
    const buildBase = () => {
        tagsContainer.innerHTML = '';
        const icon = document.createElement('i');
        icon.className = 'bi bi-tags nav-meta__icon';
        const label = document.createElement('span');
        label.className = 'nav-meta__label';
        label.textContent = 'Top tags';
        tagsContainer.appendChild(icon);
        tagsContainer.appendChild(label);
        return { icon, label };
    };
    if (!cardsList || cardsList.length === 0) {
        buildBase();
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
    const { icon, label } = buildBase();
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
        const tagText = document.createElement('span');
        tagText.className = 'nav-tag__text';
        tagText.textContent = tag;
        tagText.title = tag;
        const badge = document.createElement('span');
        badge.className = 'nav-tag__count';
        badge.textContent = `(${count})`;
        button.appendChild(tagText);
        button.appendChild(badge);
        button.addEventListener('click', () => TagFilter(tag));
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
        const response = await fetch(GroupEndpoint, EncodingHeader);
        const data = await response.json();
        GroupData = data.response;
    }
    catch (err) {
        return console.error(err);
    }
}
function PopulateDropDown(data, elementTarget) {
    const button = document.getElementById(buttonId);
    button.onclick = function () {
        dropdown.ToggleDropdown('groupdropdown', buttonId);
    };
    const dropDown = document.getElementById(elementTarget);
    for (const item of data.groups) {
        console.log('Adding to group dropdown' + item);
        dropdown.AddDropDownElement(dropDown, '/?group=' + item, item);
    }
    ;
}
