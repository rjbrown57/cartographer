import { GetNoteSortMode, NoteSortOptions, SetNoteSortMode, SortNotes } from '../preferences/noteSort.js';
import { FetchAdminSession, FetchNamespaces, FetchNotes, GetSelectedNamespace, SetSelectedNamespace, } from '../shared/api.js';
import { CountMobileTags, MatchesMobileSearch } from './model.js';
import { MobileNoteFeed } from './noteFeed.js';
const ViewPreferenceKey = 'cartographer_view_preference';
class MobileCartographer {
    notes = [];
    namespace = GetSelectedNamespace();
    sortMode = GetNoteSortMode();
    feed;
    feedElement;
    searchInput;
    clearSearch;
    namespaceStrip;
    resultCount;
    resultContext;
    activeFilters;
    tagFilters;
    sortSelect;
    filterSheet;
    filterToggle;
    addNote;
    constructor() {
        this.feedElement = this.RequireElement('mobileFeed');
        this.searchInput = this.RequireElement('mobileSearch');
        this.clearSearch = this.RequireElement('mobileSearchClear');
        this.namespaceStrip = this.RequireElement('mobileNamespaces');
        this.resultCount = this.RequireElement('mobileResultCount');
        this.resultContext = this.RequireElement('mobileResultContext');
        this.activeFilters = this.RequireElement('mobileActiveFilters');
        this.tagFilters = this.RequireElement('mobileTagFilters');
        this.sortSelect = this.RequireElement('mobileSort');
        this.filterSheet = this.RequireElement('mobileFilterSheet');
        this.filterToggle = this.RequireElement('mobileFilterToggle');
        this.addNote = this.RequireElement('mobileAddNote');
        this.feed = new MobileNoteFeed(this.feedElement, (tag) => void this.ToggleTag(tag));
        this.ApplyViewPreference();
        this.BindControls();
        void this.Initialize();
    }
    RequireElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Mobile shell is missing #${id}`);
        }
        return element;
    }
    ApplyViewPreference() {
        const url = new URL(window.location.href);
        if (url.searchParams.get('view') !== 'mobile') {
            return;
        }
        try {
            localStorage.setItem(ViewPreferenceKey, 'mobile');
        }
        catch {
        }
        url.searchParams.delete('view');
        window.history.replaceState({}, '', url.toString());
    }
    BindControls() {
        const form = this.RequireElement('mobileSearchForm');
        const closeSheet = this.RequireElement('mobileFilterClose');
        const sheetBackdrop = this.RequireElement('mobileFilterBackdrop');
        const desktopView = this.RequireElement('mobileDesktopView');
        const feedFilter = this.RequireElement('mobileFeedFilter');
        this.searchInput.value = new URLSearchParams(window.location.search).getAll('term').join(' ');
        this.UpdateSearchClearState();
        this.searchInput.addEventListener('input', () => {
            this.UpdateSearchClearState();
            this.RenderNotes();
        });
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.CommitSearch();
        });
        this.clearSearch.addEventListener('click', () => this.ClearSearch());
        this.filterToggle.addEventListener('click', () => this.SetFilterSheet(true));
        feedFilter.addEventListener('click', () => this.SetFilterSheet(true));
        closeSheet.addEventListener('click', () => this.SetFilterSheet(false));
        sheetBackdrop.addEventListener('click', () => this.SetFilterSheet(false));
        desktopView.addEventListener('click', () => {
            try {
                localStorage.setItem(ViewPreferenceKey, 'desktop');
            }
            catch {
            }
        });
        this.sortSelect.addEventListener('change', () => {
            this.sortMode = this.sortSelect.value;
            SetNoteSortMode(this.sortMode);
            this.RenderNotes();
        });
        window.addEventListener('popstate', () => {
            this.namespace = GetSelectedNamespace();
            this.searchInput.value = new URLSearchParams(window.location.search).getAll('term').join(' ');
            this.UpdateSearchClearState();
            void this.RefreshNotes();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.SetFilterSheet(false);
            }
        });
    }
    async Initialize() {
        this.RenderSortOptions();
        const chromePromise = this.RefreshChrome();
        await Promise.all([chromePromise, this.RefreshNotes()]);
    }
    async RefreshChrome() {
        const [namespaces, session] = await Promise.all([
            FetchNamespaces().catch(() => [this.namespace]),
            FetchAdminSession().catch(() => ({ admin: false, configured: false })),
        ]);
        const available = Array.from(new Set([...namespaces, this.namespace])).sort((left, right) => left.localeCompare(right));
        this.RenderNamespaces(available);
        this.addNote.classList.toggle('is-visible', session.admin);
        this.UpdateAddNoteURL();
    }
    async RefreshNotes() {
        this.feedElement.setAttribute('aria-busy', 'true');
        this.feedElement.innerHTML = '<div class="mobile-loading"><span></span><span></span><span></span></div>';
        try {
            this.notes = await FetchNotes(this.namespace);
            this.RenderNotes();
            this.RenderTagFilters();
            this.RenderActiveFilters();
        }
        catch (error) {
            console.error(error);
            this.feedElement.innerHTML = '<div class="mobile-empty mobile-empty--error"><i class="bi bi-wifi-off"></i><strong>Unable to load notes</strong><span>Check the connection and try again.</span></div>';
            this.resultCount.textContent = 'Unavailable';
        }
        finally {
            this.feedElement.setAttribute('aria-busy', 'false');
        }
    }
    RenderNotes() {
        const visible = this.notes.filter((note) => MatchesMobileSearch(note, this.searchInput.value));
        const sorted = SortNotes(visible, this.sortMode, new URLSearchParams(window.location.search).has('term'));
        this.feed.Render(sorted, this.namespace);
        this.resultCount.textContent = `${sorted.length} ${sorted.length === 1 ? 'note' : 'notes'}`;
        this.resultContext.textContent = `in ${this.namespace}`;
    }
    RenderNamespaces(namespaces) {
        this.namespaceStrip.replaceChildren();
        namespaces.forEach((namespace) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mobile-namespace';
            button.textContent = namespace;
            button.setAttribute('aria-pressed', String(namespace === this.namespace));
            button.addEventListener('click', () => void this.SelectNamespace(namespace));
            this.namespaceStrip.appendChild(button);
        });
    }
    async SelectNamespace(namespace) {
        if (namespace === this.namespace) {
            return;
        }
        this.namespace = namespace;
        SetSelectedNamespace(namespace);
        const url = new URL(window.location.href);
        if (namespace === 'default') {
            url.searchParams.delete('namespace');
        }
        else {
            url.searchParams.set('namespace', namespace);
        }
        window.history.pushState({}, '', url.toString());
        this.RenderNamespaces(Array.from(this.namespaceStrip.querySelectorAll('button')).map((button) => button.textContent || namespace));
        this.UpdateAddNoteURL();
        await this.RefreshNotes();
    }
    RenderSortOptions() {
        this.sortSelect.replaceChildren();
        NoteSortOptions.forEach((option) => {
            const element = document.createElement('option');
            element.value = option.id;
            element.textContent = option.label;
            this.sortSelect.appendChild(element);
        });
        this.sortSelect.value = this.sortMode;
    }
    RenderTagFilters() {
        const selected = new Set(new URLSearchParams(window.location.search).getAll('tag'));
        this.tagFilters.replaceChildren();
        CountMobileTags(this.notes).slice(0, 40).forEach(([tag, count]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mobile-filter-tag';
            button.classList.toggle('is-active', selected.has(tag));
            button.setAttribute('aria-pressed', String(selected.has(tag)));
            button.innerHTML = `<span></span><small>${count}</small>`;
            const label = button.querySelector('span');
            if (label) {
                label.textContent = tag;
            }
            button.addEventListener('click', () => void this.ToggleTag(tag));
            this.tagFilters.appendChild(button);
        });
    }
    async ToggleTag(tag) {
        const url = new URL(window.location.href);
        const tags = url.searchParams.getAll('tag');
        url.searchParams.delete('tag');
        if (tags.includes(tag)) {
            tags.filter((candidate) => candidate !== tag).forEach((candidate) => url.searchParams.append('tag', candidate));
        }
        else {
            [...tags, tag].forEach((candidate) => url.searchParams.append('tag', candidate));
        }
        window.history.pushState({}, '', url.toString());
        await this.RefreshNotes();
    }
    RenderActiveFilters() {
        const params = new URLSearchParams(window.location.search);
        const filters = [
            ...params.getAll('tag').map((value) => ({ kind: 'tag', value })),
            ...params.getAll('term').map((value) => ({ kind: 'term', value })),
        ];
        this.activeFilters.replaceChildren();
        this.activeFilters.classList.toggle('is-empty', filters.length === 0);
        filters.forEach((filter) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mobile-active-filter';
            button.innerHTML = `<span></span><i class="bi bi-x"></i>`;
            const label = button.querySelector('span');
            if (label) {
                label.textContent = filter.value;
            }
            button.addEventListener('click', () => void this.RemoveFilter(filter.kind, filter.value));
            this.activeFilters.appendChild(button);
        });
    }
    async RemoveFilter(kind, value) {
        const url = new URL(window.location.href);
        const remaining = url.searchParams.getAll(kind).filter((candidate) => candidate !== value);
        url.searchParams.delete(kind);
        remaining.forEach((candidate) => url.searchParams.append(kind, candidate));
        window.history.pushState({}, '', url.toString());
        this.searchInput.value = url.searchParams.getAll('term').join(' ');
        this.UpdateSearchClearState();
        await this.RefreshNotes();
    }
    CommitSearch() {
        const url = new URL(window.location.href);
        url.searchParams.delete('term');
        this.searchInput.value.split(/\s+/).map((term) => term.trim()).filter(Boolean)
            .forEach((term) => url.searchParams.append('term', term));
        window.history.pushState({}, '', url.toString());
        void this.RefreshNotes();
    }
    ClearSearch() {
        const hadTerms = new URLSearchParams(window.location.search).has('term');
        this.searchInput.value = '';
        this.UpdateSearchClearState();
        if (!hadTerms) {
            this.RenderNotes();
            return;
        }
        const url = new URL(window.location.href);
        url.searchParams.delete('term');
        window.history.pushState({}, '', url.toString());
        void this.RefreshNotes();
    }
    UpdateSearchClearState() {
        this.clearSearch.classList.toggle('is-visible', this.searchInput.value.trim() !== '');
    }
    SetFilterSheet(open) {
        this.filterSheet.classList.toggle('is-open', open);
        this.filterSheet.setAttribute('aria-hidden', String(!open));
        this.filterSheet.toggleAttribute('inert', !open);
        this.filterToggle.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('mobile-sheet-open', open);
    }
    UpdateAddNoteURL() {
        const url = new URL('/note', window.location.origin);
        url.searchParams.set('mode', 'create');
        url.searchParams.set('namespace', this.namespace);
        url.searchParams.set('returnTo', `${window.location.pathname}${window.location.search}${window.location.hash}`);
        this.addNote.href = url.toString();
    }
}
function main() {
    new MobileCartographer();
}
window.addEventListener('DOMContentLoaded', main);
