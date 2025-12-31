import * as dropdown from '../components/dropDown.js';
import { Link } from '../cards/links.js';
import { SearchBar } from '../components/searchBar.js';
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
            CartographerData.links.forEach((link) => {
                if (link.url) {
                    this.Cards.push(new Link(link.id, link.displayname, link.url, link.description, link.tags, link.data));
                }
            });
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
function SetupViewToggle() {
    const toggle = document.getElementById('viewToggle');
    const grid = document.getElementById('linkgrid');
    const header = document.getElementById('listHeader');
    if (!toggle || !grid) {
        return;
    }
    const updateToggle = (isListView) => {
        grid.classList.toggle('list-view', isListView);
        header?.classList.toggle('hidden', !isListView);
        toggle.setAttribute('aria-pressed', String(isListView));
        toggle.innerHTML = isListView
            ? '<i class="fa-solid fa-border-all mr-2"></i><span>Grid</span>'
            : '<i class="fa-solid fa-list mr-2"></i><span>List</span>';
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
        dropdown.ToggleDropdown('groupdropdown');
    };
    const dropDown = document.getElementById(elementTarget);
    for (const item of data.groups) {
        console.log('Adding to group dropdown' + item);
        dropdown.AddDropDownElement(dropDown, '/?group=' + item, item);
    }
    ;
}
