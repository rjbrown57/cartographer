import { GetNoteSortMode, NoteSortOptions, SetNoteSortMode, SortNotes, type NoteSortMode } from '../preferences/noteSort.js';
import {
    FetchAdminSession,
    FetchNamespaces,
    FetchNotes,
    GetSelectedNamespace,
    SetSelectedNamespace,
} from '../shared/api.js';
import type { NoteData } from '../shared/types.js';
import { CountMobileTags, MatchesMobileSearch } from './model.js';
import { MobileNoteFeed } from './noteFeed.js';

const ViewPreferenceKey = 'cartographer_view_preference';

// MobileCartographer coordinates the phone-only browsing experience.
class MobileCartographer {
    private notes: NoteData[] = [];
    private namespace = GetSelectedNamespace();
    private sortMode: NoteSortMode = GetNoteSortMode();
    private readonly feed: MobileNoteFeed;
    private readonly feedElement: HTMLElement;
    private readonly searchInput: HTMLInputElement;
    private readonly clearSearch: HTMLButtonElement;
    private readonly namespaceStrip: HTMLElement;
    private readonly resultCount: HTMLElement;
    private readonly resultContext: HTMLElement;
    private readonly activeFilters: HTMLElement;
    private readonly tagFilters: HTMLElement;
    private readonly sortSelect: HTMLSelectElement;
    private readonly filterSheet: HTMLElement;
    private readonly filterToggle: HTMLButtonElement;
    private readonly addNote: HTMLAnchorElement;

    // constructor resolves the mobile shell and starts the application.
    constructor() {
        this.feedElement = this.RequireElement('mobileFeed');
        this.searchInput = this.RequireElement<HTMLInputElement>('mobileSearch');
        this.clearSearch = this.RequireElement<HTMLButtonElement>('mobileSearchClear');
        this.namespaceStrip = this.RequireElement('mobileNamespaces');
        this.resultCount = this.RequireElement('mobileResultCount');
        this.resultContext = this.RequireElement('mobileResultContext');
        this.activeFilters = this.RequireElement('mobileActiveFilters');
        this.tagFilters = this.RequireElement('mobileTagFilters');
        this.sortSelect = this.RequireElement<HTMLSelectElement>('mobileSort');
        this.filterSheet = this.RequireElement('mobileFilterSheet');
        this.filterToggle = this.RequireElement<HTMLButtonElement>('mobileFilterToggle');
        this.addNote = this.RequireElement<HTMLAnchorElement>('mobileAddNote');
        this.feed = new MobileNoteFeed(this.feedElement, (tag) => void this.ToggleTag(tag));
        this.ApplyViewPreference();
        this.BindControls();
        void this.Initialize();
    }

    // RequireElement returns a typed shell element or fails loudly during development.
    private RequireElement<T extends HTMLElement = HTMLElement>(id: string): T {
        const element = document.getElementById(id) as T | null;
        if (!element) {
            throw new Error(`Mobile shell is missing #${id}`);
        }
        return element;
    }

    // ApplyViewPreference records an explicit mobile choice and cleans the URL.
    private ApplyViewPreference(): void {
        const url = new URL(window.location.href);
        if (url.searchParams.get('view') !== 'mobile') {
            return;
        }

        try {
            localStorage.setItem(ViewPreferenceKey, 'mobile');
        } catch {
            // The route itself still selects mobile when browser storage is unavailable.
        }
        url.searchParams.delete('view');
        window.history.replaceState({}, '', url.toString());
    }

    // BindControls connects mobile-only navigation, search, sorting, and sheet behavior.
    private BindControls(): void {
        const form = this.RequireElement<HTMLFormElement>('mobileSearchForm');
        const closeSheet = this.RequireElement<HTMLButtonElement>('mobileFilterClose');
        const sheetBackdrop = this.RequireElement<HTMLButtonElement>('mobileFilterBackdrop');
        const desktopView = this.RequireElement<HTMLAnchorElement>('mobileDesktopView');
        const feedFilter = this.RequireElement<HTMLButtonElement>('mobileFeedFilter');

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
            } catch {
                // The view query parameter still selects desktop without persisted storage.
            }
        });
        this.sortSelect.addEventListener('change', () => {
            this.sortMode = this.sortSelect.value as NoteSortMode;
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

    // Initialize loads shell metadata and notes concurrently for a fast first render.
    private async Initialize(): Promise<void> {
        this.RenderSortOptions();
        const chromePromise = this.RefreshChrome();
        await Promise.all([chromePromise, this.RefreshNotes()]);
    }

    // RefreshChrome loads namespaces and authoring state used around the feed.
    private async RefreshChrome(): Promise<void> {
        const [namespaces, session] = await Promise.all([
            FetchNamespaces().catch(() => [this.namespace]),
            FetchAdminSession().catch(() => ({ admin: false, configured: false })),
        ]);
        const available = Array.from(new Set([...namespaces, this.namespace])).sort((left, right) => left.localeCompare(right));
        this.RenderNamespaces(available);
        this.addNote.classList.toggle('is-visible', session.admin);
        this.UpdateAddNoteURL();
    }

    // RefreshNotes fetches the active namespace and redraws mobile metadata.
    private async RefreshNotes(): Promise<void> {
        this.feedElement.setAttribute('aria-busy', 'true');
        this.feedElement.innerHTML = '<div class="mobile-loading"><span></span><span></span><span></span></div>';
        try {
            this.notes = await FetchNotes(this.namespace);
            this.RenderNotes();
            this.RenderTagFilters();
            this.RenderActiveFilters();
        } catch (error) {
            console.error(error);
            this.feedElement.innerHTML = '<div class="mobile-empty mobile-empty--error"><i class="bi bi-wifi-off"></i><strong>Unable to load notes</strong><span>Check the connection and try again.</span></div>';
            this.resultCount.textContent = 'Unavailable';
        } finally {
            this.feedElement.setAttribute('aria-busy', 'false');
        }
    }

    // RenderNotes applies instant local search and the shared sort preference.
    private RenderNotes(): void {
        const visible = this.notes.filter((note) => MatchesMobileSearch(note, this.searchInput.value));
        const sorted = SortNotes(visible, this.sortMode, new URLSearchParams(window.location.search).has('term'));
        this.feed.Render(sorted, this.namespace);
        this.resultCount.textContent = `${sorted.length} ${sorted.length === 1 ? 'note' : 'notes'}`;
        this.resultContext.textContent = `in ${this.namespace}`;
    }

    // RenderNamespaces builds a horizontally scrolling namespace switcher.
    private RenderNamespaces(namespaces: string[]): void {
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

    // SelectNamespace updates shared state and fetches the newly selected feed.
    private async SelectNamespace(namespace: string): Promise<void> {
        if (namespace === this.namespace) {
            return;
        }

        this.namespace = namespace;
        SetSelectedNamespace(namespace);
        const url = new URL(window.location.href);
        if (namespace === 'default') {
            url.searchParams.delete('namespace');
        } else {
            url.searchParams.set('namespace', namespace);
        }
        window.history.pushState({}, '', url.toString());
        this.RenderNamespaces(Array.from(this.namespaceStrip.querySelectorAll('button')).map((button) => button.textContent || namespace));
        this.UpdateAddNoteURL();
        await this.RefreshNotes();
    }

    // RenderSortOptions displays the shared sort choices in the mobile sheet.
    private RenderSortOptions(): void {
        this.sortSelect.replaceChildren();
        NoteSortOptions.forEach((option) => {
            const element = document.createElement('option');
            element.value = option.id;
            element.textContent = option.label;
            this.sortSelect.appendChild(element);
        });
        this.sortSelect.value = this.sortMode;
    }

    // RenderTagFilters shows the most useful tags as mobile sheet controls.
    private RenderTagFilters(): void {
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

    // ToggleTag changes one backend tag filter while preserving other mobile state.
    private async ToggleTag(tag: string): Promise<void> {
        const url = new URL(window.location.href);
        const tags = url.searchParams.getAll('tag');
        url.searchParams.delete('tag');
        if (tags.includes(tag)) {
            tags.filter((candidate) => candidate !== tag).forEach((candidate) => url.searchParams.append('tag', candidate));
        } else {
            [...tags, tag].forEach((candidate) => url.searchParams.append('tag', candidate));
        }
        window.history.pushState({}, '', url.toString());
        await this.RefreshNotes();
    }

    // RenderActiveFilters creates removable chips above the feed.
    private RenderActiveFilters(): void {
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

    // RemoveFilter deletes a single URL filter and reloads backend results.
    private async RemoveFilter(kind: string, value: string): Promise<void> {
        const url = new URL(window.location.href);
        const remaining = url.searchParams.getAll(kind).filter((candidate) => candidate !== value);
        url.searchParams.delete(kind);
        remaining.forEach((candidate) => url.searchParams.append(kind, candidate));
        window.history.pushState({}, '', url.toString());
        this.searchInput.value = url.searchParams.getAll('term').join(' ');
        this.UpdateSearchClearState();
        await this.RefreshNotes();
    }

    // CommitSearch sends the search terms to the backend and updates browser history.
    private CommitSearch(): void {
        const url = new URL(window.location.href);
        url.searchParams.delete('term');
        this.searchInput.value.split(/\s+/).map((term) => term.trim()).filter(Boolean)
            .forEach((term) => url.searchParams.append('term', term));
        window.history.pushState({}, '', url.toString());
        void this.RefreshNotes();
    }

    // ClearSearch resets both instant and backend search state.
    private ClearSearch(): void {
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

    // UpdateSearchClearState reflects whether the search field can be cleared.
    private UpdateSearchClearState(): void {
        this.clearSearch.classList.toggle('is-visible', this.searchInput.value.trim() !== '');
    }

    // SetFilterSheet opens or closes the mobile-only filter surface.
    private SetFilterSheet(open: boolean): void {
        this.filterSheet.classList.toggle('is-open', open);
        this.filterSheet.setAttribute('aria-hidden', String(!open));
        this.filterSheet.toggleAttribute('inert', !open);
        this.filterToggle.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('mobile-sheet-open', open);
    }

    // UpdateAddNoteURL points authoring back to the current mobile feed.
    private UpdateAddNoteURL(): void {
        const url = new URL('/note', window.location.origin);
        url.searchParams.set('mode', 'create');
        url.searchParams.set('namespace', this.namespace);
        url.searchParams.set('returnTo', `${window.location.pathname}${window.location.search}${window.location.hash}`);
        this.addNote.href = url.toString();
    }
}

// main starts the isolated mobile application after its shell is ready.
function main(): void {
    new MobileCartographer();
}

window.addEventListener('DOMContentLoaded', main);
