import * as cards from '../cards/cards.js';
import { Note } from '../cards/notes.js';
import type { TimestampValue } from '../cards/notes.js';
import { SearchBar, TagFilter } from '../components/searchBar.js';
import * as cache from '../components/cache.js';
import * as query from '../query/query.js';
import {
    GetNoteSortMode,
    NoteSortOptions,
    SetNoteSortMode,
    SortNotes,
    type NoteSortMode,
} from '../preferences/noteSort.js';
import { RenderMarkdown } from '../shared/markdown.js';

const EncodingHeader = {
    headers: {
        'Accept-Encoding': 'gzip'
    }
}

let CartographerData: CartoResponse;
let TemplateData: MarkdownTemplate[] = [];

const NamespaceEndpoint = query.GetEndpoint + '/namespaces';
const NotesEndpoint = '/v1/notes';
const TemplatesEndpoint = '/v1/admin/templates';
const AdminSessionEndpoint = '/v1/admin/session';
const AdminNamespacesEndpoint = '/v1/admin/namespaces';
const NamespaceListId = 'namespaceList'
const NamespaceFinderId = 'namespaceFinder'
const NamespaceSearchThreshold = 16;
const NoteCacheChangedEvent = 'cartographer:note-cache-changed';
const NamespacePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const NamespaceColorPattern = /^#[0-9a-f]{6}$/;
const DefaultNamespaceColor = '#38bdf8';
const NamespaceColorsStorageKey = 'cartographer_namespace_colors';
const TopTagsCollapsedStorageKey = 'cartographer_top_tags_collapsed';
const CardStyleStorageKey = 'cartographer_card_style';
const LegacyCardDensityStorageKey = 'cartographer_cards_condensed';

type CardStyleID = 'comfortable' | 'condensed';

type CardStyleOption = {
    id: CardStyleID;
    label: string;
    icon: string;
    summary: string;
    bodyClass?: string;
};

const CardStyleOptions: CardStyleOption[] = [
    {
        id: 'comfortable',
        label: 'Comfortable',
        icon: 'bi bi-card-text',
        summary: 'Body preview shown in each card.',
    },
    {
        id: 'condensed',
        label: 'Condensed',
        icon: 'bi bi-view-stacked',
        summary: 'Body hidden until a card is opened.',
        bodyClass: 'card-style-condensed',
    },
];

export type CartoResponse = {
    notes: NoteData[];
}

export type NamespaceResponse = {
    msg: string[];
}

export type NoteData = {
    id: string;
    title: string;
    url: string;
    body: string;
    tags: string[];
    data?: Record<string, any>;
    created_at?: TimestampValue;
    updated_at?: TimestampValue;
    source?: string;
    author?: string;
    version?: number;
}

export type MarkdownTemplate = {
    id: string;
    name: string;
    description?: string;
    body: string;
    tags?: string[];
    source?: string;
    author?: string;
    created_at?: TimestampValue;
    updated_at?: TimestampValue;
    version?: number;
}

export type TemplateResponse = {
    templates: MarkdownTemplate[];
}

export type AdminSessionResponse = {
    admin: boolean;
    configured: boolean;
}

type NoteDeleteEvent = CustomEvent<{
    id: string;
    title: string;
}>;

type NamespaceSwitchHandler = (namespace: string, nextURL: URL) => Promise<void>;
type NamespaceColorChangeHandler = (namespace: string, color: string | null) => boolean;

// Cartographer class is used to represent a collection of cards
// move to it's own file
export class Cartographer {
    Cards: Note[] = [];
    SearchBar: SearchBar;
    private renderVersion: number = 0;
    private noteSortMode: NoteSortMode = GetNoteSortMode();
    // Initialize data, build cards, and wire up UI controls.
    constructor() {
        this.SearchBar = new SearchBar(this.Cards);
        SetupCardStyleControls();
        SetupNoteSortControls(this.noteSortMode, (mode) => {
            this.noteSortMode = mode;
            this.BuildAndRenderCards();
        });
        SetupAdminPanel();
        this.SetupNoteDeletion();
        document.addEventListener(NoteCacheChangedEvent, () => {
            void this.LoadCurrentNamespace();
        });
        this.Initialize();
    }

    // Initialize prepares namespace state, loads backend data, and then renders cards.
    private async Initialize(): Promise<void> {
        await SetupNamespaceSelector(this.SwitchNamespace.bind(this));
        await this.LoadCurrentNamespace();
    }

    // LoadCurrentNamespace fetches, rebuilds, and renders cards for the selected namespace.
    private async LoadCurrentNamespace(): Promise<void> {
        await QueryMainData();

        this.BuildAndRenderCards();
    }

    // BuildAndRenderCards rebuilds the deck in the selected per-browser sort order.
    private BuildAndRenderCards(): void {
        if (!CartographerData || !Array.isArray(CartographerData.notes)) {
            console.error('No notes data available to render');
            RenderNavMetadata([]);
            return;
        }

        this.Cards.splice(0, this.Cards.length);
        const hasTermSearch = new URLSearchParams(window.location.search).has('term');
        const sortedNotes = SortNotes(CartographerData.notes, this.noteSortMode, hasTermSearch);
        sortedNotes.forEach((note) => {
            const resolvedID = note.id || note.url || note.title;
            if (!resolvedID) {
                return;
            }

            const resolvedURL = note.url || '';
            const resolvedTitle = note.title || resolvedURL || resolvedID;
            const resolvedBody = note.body || resolvedURL || '';
            const resolvedTags = Array.isArray(note.tags) ? note.tags : [];

            this.Cards.push(
                new Note(
                    resolvedID,
                    resolvedTitle,
                    resolvedBody,
                    resolvedURL,
                    resolvedTags,
                    note.data,
                    {
                        created_at: note.created_at,
                        updated_at: note.updated_at,
                        source: note.source,
                        author: note.author,
                        version: note.version,
                    }
                )
            );
        });

        RenderNavMetadata(this.Cards);
        this.renderCards();
        this.Cards.forEach(card => card.processFilter(this.SearchBar.filter));
    }

    // SetupNoteDeletion wires admin note deletion events from card actions.
    private SetupNoteDeletion(): void {
        document.addEventListener('cartographer:delete-note', (event) => {
            void this.DeleteNote(event as NoteDeleteEvent);
        });
    }

    // DeleteNote removes a note through the admin-protected delete endpoint.
    private async DeleteNote(event: NoteDeleteEvent): Promise<void> {
        const detail = event.detail;
        if (!detail?.id) {
            return;
        }
        if (!window.confirm(`Delete note "${detail.title || detail.id}"?`)) {
            return;
        }

        const endpoint = new URL(NotesEndpoint, window.location.origin);
        endpoint.searchParams.set('id', detail.id);
        endpoint.searchParams.set('namespace', query.GetSelectedNamespace());

        try {
            const response = await fetch(endpoint.toString(), { method: 'DELETE' });
            if (!response.ok) {
                throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
            }

            cache.invalidateCache();
            const cardIndex = this.Cards.findIndex((card) => card instanceof Note && card.id === detail.id);
            const deletedCard = this.Cards[cardIndex];
            if (deletedCard instanceof Note) {
                deletedCard.minimize();
            }
            if (cardIndex >= 0) {
                this.Cards.splice(cardIndex, 1);
            }
            CartographerData.notes = CartographerData.notes.filter((note) => {
                const noteID = note.id || note.url || note.title;
                return noteID !== detail.id;
            });
            RenderNavMetadata(this.Cards);
            this.renderCards();
        } catch (err) {
            console.error(err);
            window.alert('Unable to delete note.');
        }
    }

    // SwitchNamespace updates namespace state and refreshes cards without a full page reload.
    private async SwitchNamespace(namespace: string, nextURL: URL): Promise<void> {
        try {
            window.history.pushState({}, '', nextURL.toString());
            query.SetSelectedNamespace(namespace);
            document.body.classList.add('namespace-switching');

            const searchElement = document.getElementById('searchBar') as HTMLInputElement | null;
            if (searchElement) {
                searchElement.value = '';
            }

            await SetupNamespaceSelector(this.SwitchNamespace.bind(this));
            await this.LoadCurrentNamespace();
        } finally {
            requestAnimationFrame(() => {
                document.body.classList.remove('namespace-switching');
            });
        }
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
        const currentRenderVersion = ++this.renderVersion;
        container.innerHTML = '';

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
                if (currentRenderVersion !== this.renderVersion) {
                    return;
                }

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

// SetupNoteSortControls wires the cookie-backed note ordering preference.
function SetupNoteSortControls(initialMode: NoteSortMode, onChange: (mode: NoteSortMode) => void): void {
    const select = document.getElementById('noteSortSelect') as HTMLSelectElement | null;
    const summary = document.getElementById('noteSortSummary') as HTMLElement | null;
    if (!select) {
        return;
    }

    const optionsByID = new Map(NoteSortOptions.map(option => [option.id, option]));

    // applyNoteSort updates the control summary and optionally persists the selection.
    const applyNoteSort = (mode: NoteSortMode, persist: boolean) => {
        const selected = optionsByID.get(mode) || NoteSortOptions[0];
        select.value = selected.id;
        if (summary) {
            summary.textContent = selected.summary;
        }
        if (persist) {
            SetNoteSortMode(selected.id);
            onChange(selected.id);
        }
    };

    select.replaceChildren();
    NoteSortOptions.forEach(option => {
        const element = document.createElement('option');
        element.value = option.id;
        element.textContent = option.label;
        select.appendChild(element);
    });

    select.addEventListener('change', () => {
        const selected = optionsByID.get(select.value as NoteSortMode) || NoteSortOptions[0];
        applyNoteSort(selected.id, true);
    });

    applyNoteSort(initialMode, false);
}

// SetupCardStyleControls wires the tools control that switches card rendering styles.
function SetupCardStyleControls(): void {
    const optionsContainer = document.getElementById('cardStyleOptions') as HTMLElement | null;
    const summary = document.getElementById('cardStyleSummary') as HTMLElement | null;
    if (!optionsContainer) {
        return;
    }

    const styleByID = new Map(CardStyleOptions.map(style => [style.id, style]));

    // getInitialCardStyle returns the stored style, including migration from the old boolean key.
    const getInitialCardStyle = (): CardStyleID => {
        const storedStyle = localStorage.getItem(CardStyleStorageKey) as CardStyleID | null;
        if (storedStyle && styleByID.has(storedStyle)) {
            return storedStyle;
        }

        const legacyCondensed = localStorage.getItem(LegacyCardDensityStorageKey);
        if (legacyCondensed === 'true') {
            localStorage.setItem(CardStyleStorageKey, 'condensed');
            localStorage.removeItem(LegacyCardDensityStorageKey);
            return 'condensed';
        }

        return 'comfortable';
    };

    // applyCardStyle swaps body style classes and marks the selected Tools option.
    const applyCardStyle = (styleID: CardStyleID) => {
        const selectedStyle = styleByID.get(styleID) || CardStyleOptions[0];
        CardStyleOptions.forEach(style => {
            if (style.bodyClass) {
                document.body.classList.toggle(style.bodyClass, style.id === selectedStyle.id);
            }
        });

        if (summary) {
            summary.textContent = selectedStyle.summary;
        }

        optionsContainer.querySelectorAll<HTMLButtonElement>('[data-card-style]').forEach(button => {
            const isSelected = button.dataset.cardStyle === selectedStyle.id;
            button.classList.toggle('btn-primary', isSelected);
            button.classList.toggle('btn-outline-secondary', !isSelected);
            button.setAttribute('aria-pressed', String(isSelected));
        });

        localStorage.setItem(CardStyleStorageKey, selectedStyle.id);
    };

    optionsContainer.replaceChildren();
    CardStyleOptions.forEach(style => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2 card-style-option';
        button.dataset.cardStyle = style.id;
        button.setAttribute('aria-pressed', 'false');
        button.innerHTML = `<i class="${style.icon}"></i><span>${style.label}</span>`;
        button.addEventListener('click', () => {
            applyCardStyle(style.id);
        });
        optionsContainer.appendChild(button);
    });

    applyCardStyle(getInitialCardStyle());
}

// GetTopTagsCollapsed returns whether the top tags row should render collapsed.
function GetTopTagsCollapsed(): boolean {
    return localStorage.getItem(TopTagsCollapsedStorageKey) === 'true';
}

// SetTopTagsCollapsed persists whether the top tags row should render collapsed.
function SetTopTagsCollapsed(collapsed: boolean): void {
    localStorage.setItem(TopTagsCollapsedStorageKey, String(collapsed));
}

// SetupAdminPanel wires the admin template panel to the backend endpoints.
function SetupAdminPanel(): void {
    const panel = document.getElementById('adminPanel') as HTMLElement | null;
    const toggle = document.getElementById('adminPanelToggle') as HTMLButtonElement | null;
    const close = document.getElementById('adminPanelClose') as HTMLButtonElement | null;
    const body = document.getElementById('adminPanelBody') as HTMLElement | null;
    const cacheSummary = document.getElementById('cacheSummary') as HTMLElement | null;
    const cacheKeyList = document.getElementById('cacheKeyList') as HTMLUListElement | null;
    const cacheKeyDetails = document.getElementById('cacheKeyDetails') as HTMLDetailsElement | null;
    const clearCacheButton = document.getElementById('clearCacheButton') as HTMLButtonElement | null;
    const noteCacheToggle = document.getElementById('noteCacheToggle') as HTMLInputElement | null;
    const cacheToolsStatus = document.getElementById('cacheToolsStatus') as HTMLElement | null;
    const loginForm = document.getElementById('adminLoginForm') as HTMLFormElement | null;
    const tokenInput = document.getElementById('adminToken') as HTMLInputElement | null;
    const loginStatus = document.getElementById('adminLoginStatus') as HTMLElement | null;
    const unavailable = document.getElementById('adminUnavailable') as HTMLElement | null;
    const logout = document.getElementById('adminLogout') as HTMLButtonElement | null;
    const templateComposer = document.getElementById('templateComposer') as HTMLElement | null;
    const templateComposerClose = document.getElementById('templateComposerClose') as HTMLButtonElement | null;
    const newTemplateButton = document.getElementById('newTemplateButton') as HTMLButtonElement | null;
    const form = document.getElementById('templateForm') as HTMLFormElement | null;
    const formTitle = document.getElementById('templateFormTitle') as HTMLElement | null;
    const idInput = document.getElementById('templateID') as HTMLInputElement | null;
    const nameInput = document.getElementById('templateName') as HTMLInputElement | null;
    const descriptionInput = document.getElementById('templateDescription') as HTMLInputElement | null;
    const tagsInput = document.getElementById('templateTags') as HTMLInputElement | null;
    const bodyInput = document.getElementById('templateBody') as HTMLTextAreaElement | null;
    const writeTab = document.getElementById('templateWriteTab') as HTMLButtonElement | null;
    const previewTab = document.getElementById('templatePreviewTab') as HTMLButtonElement | null;
    const previewPane = document.getElementById('templatePreview') as HTMLElement | null;
    const submit = document.getElementById('templateSubmit') as HTMLButtonElement | null;
    const cancelEdit = document.getElementById('templateCancelEdit') as HTMLButtonElement | null;
    const status = document.getElementById('templateFormStatus') as HTMLElement | null;
    const list = document.getElementById('adminTemplateList') as HTMLElement | null;
    const namespaceList = document.getElementById('adminNamespaceList') as HTMLElement | null;
    const namespaceStatus = document.getElementById('adminNamespaceStatus') as HTMLElement | null;
    const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-admin-tab]'));
    const tabPanels = Array.from(document.querySelectorAll<HTMLElement>('[data-admin-panel]'));

    if (!panel || !toggle || !body || !loginForm || !form || !list || !namespaceList) {
        return;
    }

    let adminSession: AdminSessionResponse = { admin: false, configured: false };
    let activeAdminTab = 'templates';
    let templateEditorMode: 'write' | 'preview' = 'write';

    // renderCacheTools refreshes the public browser cache summary.
    const renderCacheTools = () => {
        const enabled = cache.isNoteCacheEnabled();
        const cacheKeys = cache.getCacheKeys();
        if (noteCacheToggle) {
            noteCacheToggle.checked = enabled;
        }
        if (clearCacheButton) {
            clearCacheButton.disabled = !enabled;
        }
        cacheKeyDetails?.classList.toggle('is-hidden', !enabled);
        if (cacheSummary) {
            const entryLabel = cacheKeys.length === 1 ? 'entry' : 'entries';
            cacheSummary.textContent = enabled
                ? `${cacheKeys.length} cached ${entryLabel}`
                : 'Note caching disabled';
        }

        if (!cacheKeyList) {
            return;
        }

        cacheKeyList.replaceChildren();
        if (cacheKeys.length === 0) {
            const item = document.createElement('li');
            item.textContent = 'No cached queries.';
            cacheKeyList.appendChild(item);
            return;
        }

        cacheKeys.forEach((key) => {
            const item = document.createElement('li');
            item.textContent = key;
            cacheKeyList.appendChild(item);
        });
    };

    // clearCacheTools invalidates the public browser data cache.
    const clearCacheTools = () => {
        cache.invalidateCache();
        renderCacheTools();
        if (cacheToolsStatus) {
            cacheToolsStatus.textContent = 'Cache cleared.';
            cacheToolsStatus.className = 'note-form-status text-success';
        }
    };

    // loadAdminSession fetches the browser's current admin session state.
    const loadAdminSession = async () => {
        try {
            const response = await fetch(AdminSessionEndpoint, EncodingHeader);
            if (!response.ok) {
                throw new Error(`Session check failed: ${response.status} ${response.statusText}`);
            }
            adminSession = await response.json() as AdminSessionResponse;
        } catch (err) {
            console.error(err);
            adminSession = { admin: false, configured: false };
        }
    };

    // renderAdminSession toggles login, unavailable, and admin management states.
    const renderAdminSession = () => {
        document.body.classList.toggle('is-admin', adminSession.admin);
        unavailable?.classList.toggle('is-hidden', adminSession.configured);
        loginForm.classList.toggle('is-hidden', !adminSession.configured || adminSession.admin);
        body.classList.toggle('is-hidden', !adminSession.admin);
        logout?.classList.toggle('is-hidden', !adminSession.admin);
    };

    // setAdminTab swaps the active admin section without leaving the modal.
    const setAdminTab = (tabName: string) => {
        activeAdminTab = tabName;
        tabButtons.forEach((button) => {
            const isActive = button.dataset.adminTab === activeAdminTab;
            button.setAttribute('aria-selected', String(isActive));
            button.tabIndex = isActive ? 0 : -1;
        });
        tabPanels.forEach((adminPanel) => {
            adminPanel.classList.toggle('is-hidden', adminPanel.dataset.adminPanel !== activeAdminTab);
        });
    };

    // renderAdminPanels refreshes the current admin management views.
    const renderAdminPanels = async () => {
        await RenderTemplateList(list, editTemplate, deleteTemplate);
        await RenderAdminNamespaceList(namespaceList, deleteNamespace, setNamespaceColor);
    };

    // updateTemplatePreview renders the authoring preview from the template markdown.
    const updateTemplatePreview = () => {
        if (!previewPane) {
            return;
        }
        previewPane.innerHTML = RenderMarkdown(bodyInput?.value || '');
    };

    // setTemplateEditorMode swaps the authoring surface between write and preview.
    const setTemplateEditorMode = (mode: 'write' | 'preview') => {
        templateEditorMode = mode;
        const isPreview = mode === 'preview';
        bodyInput?.classList.toggle('is-hidden', isPreview);
        previewPane?.classList.toggle('is-hidden', !isPreview);
        writeTab?.classList.toggle('note-editor-tab--active', !isPreview);
        previewTab?.classList.toggle('note-editor-tab--active', isPreview);
        writeTab?.setAttribute('aria-pressed', String(!isPreview));
        previewTab?.setAttribute('aria-pressed', String(isPreview));
        if (isPreview) {
            updateTemplatePreview();
        }
    };

    // resetTemplateForm clears edit state and returns the composer to create mode.
    const resetTemplateForm = () => {
        form.reset();
        if (idInput) {
            idInput.value = '';
        }
        if (formTitle) {
            formTitle.textContent = 'New template';
        }
        if (status) {
            status.textContent = '';
            status.className = 'note-form-status';
        }
        submit?.querySelector('span')?.replaceChildren(document.createTextNode('Save template'));
        setTemplateEditorMode('write');
    };

    // setTemplateComposerOpen toggles the large template authoring modal.
    const setTemplateComposerOpen = (open: boolean) => {
        templateComposer?.classList.toggle('is-hidden', !open);
        document.body.classList.toggle('modal-open', open || !panel.classList.contains('is-hidden'));
        if (open) {
            nameInput?.focus();
        }
    };

    // openTemplateComposer prepares the authoring modal for a new or existing template.
    const openTemplateComposer = (template?: MarkdownTemplate) => {
        resetTemplateForm();
        if (template) {
            if (idInput) {
                idInput.value = template.id;
            }
            if (nameInput) {
                nameInput.value = template.name;
            }
            if (descriptionInput) {
                descriptionInput.value = template.description || '';
            }
            if (tagsInput) {
                tagsInput.value = (template.tags || []).join(', ');
            }
            if (bodyInput) {
                bodyInput.value = template.body;
            }
            if (formTitle) {
                formTitle.textContent = 'Edit template';
            }
            submit?.querySelector('span')?.replaceChildren(document.createTextNode('Update template'));
        }
        setTemplateComposerOpen(true);
    };

    // editTemplate loads a template into the admin form for resubmission.
    const editTemplate = (template: MarkdownTemplate) => {
        openTemplateComposer(template);
    };

    // deleteTemplate removes a template and refreshes all template views.
    const deleteTemplate = async (template: MarkdownTemplate) => {
        if (!window.confirm(`Delete template "${template.name}"?`)) {
            return;
        }

        if (status) {
            status.textContent = 'Deleting template...';
            status.className = 'note-form-status text-secondary';
        }

        try {
            const response = await fetch(`${TemplatesEndpoint}/${encodeURIComponent(template.id)}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
            }

            resetTemplateForm();
            TemplateData = [];
            await RenderTemplateList(list, editTemplate, deleteTemplate);
            if (status) {
                status.textContent = 'Template deleted.';
                status.className = 'note-form-status text-success';
            }
        } catch (err) {
            console.error(err);
            if (status) {
                status.textContent = 'Unable to delete template.';
                status.className = 'note-form-status text-danger';
            }
        }
    };

    // deleteNamespace removes every note in a namespace and refreshes the app shell.
    const deleteNamespace = async (namespace: string) => {
        if (!window.confirm(`Delete namespace "${namespace}" and all notes inside it?`)) {
            return;
        }

        if (namespaceStatus) {
            namespaceStatus.textContent = 'Deleting namespace...';
            namespaceStatus.className = 'note-form-status text-secondary';
        }

        try {
            const response = await fetch(`${AdminNamespacesEndpoint}/${encodeURIComponent(namespace)}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
            }

            cache.invalidateCache();
            SaveNamespaceColor(namespace, null);
            await RenderAdminNamespaceList(namespaceList, deleteNamespace, setNamespaceColor);
            await SetupNamespaceSelector();
            if (namespaceStatus) {
                namespaceStatus.textContent = 'Namespace deleted.';
                namespaceStatus.className = 'note-form-status text-success';
            }

            if (namespace === query.GetSelectedNamespace()) {
                query.SetSelectedNamespace('default');
                window.location.assign(GetNamespaceURL('default').toString());
            }
        } catch (err) {
            console.error(err);
            if (namespaceStatus) {
                namespaceStatus.textContent = 'Unable to delete namespace.';
                namespaceStatus.className = 'note-form-status text-danger';
            }
        }
    };

    // setNamespaceColor stores one browser-local preference and updates visible tabs.
    const setNamespaceColor = (namespace: string, color: string | null): boolean => {
        try {
            SaveNamespaceColor(namespace, color);
            ApplyNamespaceColorToTabs(namespace, color);
            if (namespaceStatus) {
                namespaceStatus.textContent = color
                    ? 'Namespace color saved in this browser.'
                    : 'Namespace color reset in this browser.';
                namespaceStatus.className = 'note-form-status text-success';
            }
            return true;
        } catch (err) {
            console.error(err);
            if (namespaceStatus) {
                namespaceStatus.textContent = 'Unable to save namespace color in this browser.';
                namespaceStatus.className = 'note-form-status text-danger';
            }
            return false;
        }
    };

    // setAdminOpen toggles the modal-like admin panel.
    const setAdminOpen = async (open: boolean) => {
        panel.classList.toggle('is-hidden', !open);
        document.body.classList.toggle('modal-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.classList.toggle('nav-action--active', open);
        if (open) {
            renderCacheTools();
            await loadAdminSession();
            renderAdminSession();
            if (adminSession.admin) {
                await renderAdminPanels();
                setAdminTab(activeAdminTab);
                if (activeAdminTab === 'templates') {
                    newTemplateButton?.focus();
                }
            } else if (adminSession.configured) {
                tokenInput?.focus();
            }
        }
    };

    toggle.addEventListener('click', () => {
        void setAdminOpen(panel.classList.contains('is-hidden'));
    });

    close?.addEventListener('click', () => {
        void setAdminOpen(false);
        toggle.focus();
    });

    panel.addEventListener('click', (event) => {
        if (event.target === panel) {
            void setAdminOpen(false);
            toggle.focus();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !panel.classList.contains('is-hidden')) {
            if (templateComposer && !templateComposer.classList.contains('is-hidden')) {
                setTemplateComposerOpen(false);
                return;
            }
            void setAdminOpen(false);
            toggle.focus();
        }
    });

    tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            setAdminTab(button.dataset.adminTab || 'templates');
        });
    });

    clearCacheButton?.addEventListener('click', () => {
        clearCacheTools();
    });

    noteCacheToggle?.addEventListener('change', () => {
        const enabled = noteCacheToggle.checked;
        cache.setNoteCacheEnabled(enabled);
        renderCacheTools();
        if (cacheToolsStatus) {
            cacheToolsStatus.textContent = enabled
                ? 'Note caching enabled.'
                : 'Note caching disabled. Stored notes cleared.';
            cacheToolsStatus.className = 'note-form-status text-success';
        }
        document.dispatchEvent(new CustomEvent(NoteCacheChangedEvent));
    });

    newTemplateButton?.addEventListener('click', () => {
        openTemplateComposer();
    });

    templateComposerClose?.addEventListener('click', () => {
        setTemplateComposerOpen(false);
    });

    templateComposer?.addEventListener('click', (event) => {
        if (event.target === templateComposer) {
            setTemplateComposerOpen(false);
        }
    });

    writeTab?.addEventListener('click', () => {
        setTemplateEditorMode('write');
    });

    previewTab?.addEventListener('click', () => {
        setTemplateEditorMode('preview');
    });

    bodyInput?.addEventListener('input', () => {
        if (templateEditorMode === 'preview') {
            updateTemplatePreview();
        }
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (loginStatus) {
            loginStatus.textContent = 'Checking token...';
            loginStatus.className = 'note-form-status text-secondary';
        }

        try {
            const response = await fetch(AdminSessionEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: tokenInput?.value || '' }),
            });
            if (!response.ok) {
                throw new Error(`Login failed: ${response.status} ${response.statusText}`);
            }

            adminSession = await response.json() as AdminSessionResponse;
            if (tokenInput) {
                tokenInput.value = '';
            }
            renderAdminSession();
            await renderAdminPanels();
            setAdminTab(activeAdminTab);
            if (activeAdminTab === 'templates') {
                newTemplateButton?.focus();
            }
            if (loginStatus) {
                loginStatus.textContent = '';
            }
        } catch (err) {
            console.error(err);
            if (loginStatus) {
                loginStatus.textContent = 'Unable to unlock admin.';
                loginStatus.className = 'note-form-status text-danger';
            }
        }
    });

    logout?.addEventListener('click', async () => {
        await fetch(AdminSessionEndpoint, { method: 'DELETE' });
        adminSession = { admin: false, configured: true };
        resetTemplateForm();
        renderAdminSession();
        tokenInput?.focus();
    });

    cancelEdit?.addEventListener('click', () => {
        setTemplateComposerOpen(false);
    });

    void loadAdminSession().then(renderAdminSession);
    renderCacheTools();
    setAdminTab(activeAdminTab);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = nameInput?.value.trim() || '';
        const body = bodyInput?.value.trim() || '';
        if (!name || !body) {
            if (status) {
                status.textContent = 'Name and markdown are required.';
                status.className = 'note-form-status text-danger';
            }
            return;
        }

        if (status) {
            status.textContent = 'Saving template...';
            status.className = 'note-form-status text-secondary';
        }

        try {
            const response = await fetch(TemplatesEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: idInput?.value || undefined,
                    name,
                    description: descriptionInput?.value.trim() || '',
                    body,
                    tags: ParseCommaList(tagsInput?.value || ''),
                }),
            });
            if (!response.ok) {
                throw new Error(`Save failed: ${response.status} ${response.statusText}`);
            }

            resetTemplateForm();
            TemplateData = [];
            await RenderTemplateList(list, editTemplate, deleteTemplate);
            setTemplateComposerOpen(false);
            if (status) {
                status.textContent = 'Template saved.';
                status.className = 'note-form-status text-success';
            }
        } catch (err) {
            console.error(err);
            if (status) {
                status.textContent = 'Unable to save template.';
                status.className = 'note-form-status text-danger';
            }
        }
    });
}

// LoadTemplates fetches markdown templates, using a small in-memory cache.
async function LoadTemplates(): Promise<MarkdownTemplate[]> {
    if (TemplateData.length > 0) {
        return TemplateData;
    }

    try {
        const response = await fetch(TemplatesEndpoint, EncodingHeader);
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json() as TemplateResponse;
        TemplateData = Array.isArray(data.templates) ? data.templates : [];
    } catch (err) {
        console.error(err);
        TemplateData = [];
    }

    return TemplateData;
}

// RenderTemplateList redraws the admin template list.
async function RenderTemplateList(
    container: HTMLElement,
    onEdit?: (template: MarkdownTemplate) => void,
    onDelete?: (template: MarkdownTemplate) => void,
): Promise<void> {
    const templates = await LoadTemplates();
    container.innerHTML = '';

    if (templates.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'admin-template-empty';
        empty.textContent = 'No templates yet.';
        container.appendChild(empty);
        return;
    }

    templates.forEach((template) => {
        const card = document.createElement('article');
        card.className = 'admin-template-card';

        const header = document.createElement('div');
        header.className = 'admin-template-card__header';

        const title = document.createElement('h3');
        title.textContent = template.name;
        header.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'admin-template-card__actions';

        const edit = document.createElement('button');
        edit.className = 'btn btn-sm btn-outline-secondary';
        edit.type = 'button';
        edit.title = 'Edit template';
        edit.setAttribute('aria-label', `Edit ${template.name}`);
        edit.innerHTML = '<i class="bi bi-pencil"></i>';
        edit.addEventListener('click', () => onEdit?.(template));
        actions.appendChild(edit);

        const remove = document.createElement('button');
        remove.className = 'btn btn-sm btn-outline-danger';
        remove.type = 'button';
        remove.title = 'Delete template';
        remove.setAttribute('aria-label', `Delete ${template.name}`);
        remove.innerHTML = '<i class="bi bi-trash"></i>';
        remove.addEventListener('click', () => {
            void onDelete?.(template);
        });
        actions.appendChild(remove);

        if (onEdit || onDelete) {
            header.appendChild(actions);
        }
        card.appendChild(header);

        if (template.description) {
            const description = document.createElement('p');
            description.textContent = template.description;
            card.appendChild(description);
        }

        const tagWrap = document.createElement('div');
        tagWrap.className = 'note-tag-preview';
        (template.tags || []).forEach((tag) => {
            const chip = document.createElement('span');
            chip.className = 'note-tag-chip';
            chip.textContent = tag;
            tagWrap.appendChild(chip);
        });
        card.appendChild(tagWrap);
        container.appendChild(card);
    });
}

// RenderAdminNamespaceList redraws namespace color and deletion controls.
async function RenderAdminNamespaceList(
    container: HTMLElement,
    onDelete: (namespace: string) => void,
    onColorChange: NamespaceColorChangeHandler,
): Promise<void> {
    const namespaces = await GetNamespaces();
    const colors = GetNamespaceColors();
    container.innerHTML = '';

    if (namespaces.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'admin-template-empty';
        empty.textContent = 'No namespaces available.';
        container.appendChild(empty);
        return;
    }

    namespaces.forEach((namespace) => {
        const card = document.createElement('article');
        card.className = 'admin-template-card';

        const header = document.createElement('div');
        header.className = 'admin-template-card__header';

        const title = document.createElement('h3');
        title.textContent = namespace;
        header.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'admin-template-card__actions';

        const colorControl = document.createElement('div');
        colorControl.className = 'namespace-color-control';

        const colorLabel = document.createElement('label');
        colorLabel.className = 'namespace-color-control__label';
        colorLabel.textContent = 'Tab color';

        const colorInput = document.createElement('input');
        colorInput.className = 'namespace-color-control__input';
        colorInput.type = 'color';
        colorInput.value = colors[namespace] || DefaultNamespaceColor;
        colorInput.title = `Choose tab color for ${namespace}`;
        colorInput.setAttribute('aria-label', `Tab color for namespace ${namespace}`);
        colorLabel.appendChild(colorInput);
        colorControl.appendChild(colorLabel);

        const resetColor = document.createElement('button');
        resetColor.className = 'btn btn-sm btn-outline-secondary';
        resetColor.type = 'button';
        resetColor.disabled = !colors[namespace];
        resetColor.title = 'Use default tab color';
        resetColor.setAttribute('aria-label', `Reset tab color for namespace ${namespace}`);
        resetColor.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
        colorControl.appendChild(resetColor);
        actions.appendChild(colorControl);

        colorInput.addEventListener('change', () => {
            const previousColor = colors[namespace] || DefaultNamespaceColor;
            const saved = onColorChange(namespace, colorInput.value.toLowerCase());
            if (saved) {
                colors[namespace] = colorInput.value.toLowerCase();
            } else {
                colorInput.value = previousColor;
            }
            resetColor.disabled = !colors[namespace];
        });

        resetColor.addEventListener('click', () => {
            const reset = onColorChange(namespace, null);
            if (reset) {
                delete colors[namespace];
                colorInput.value = DefaultNamespaceColor;
            }
            resetColor.disabled = !colors[namespace];
        });

        const remove = document.createElement('button');
        remove.className = 'btn btn-sm btn-outline-danger';
        remove.type = 'button';
        remove.title = 'Delete namespace';
        remove.setAttribute('aria-label', `Delete namespace ${namespace}`);
        remove.innerHTML = '<i class="bi bi-trash"></i>';
        remove.addEventListener('click', () => {
            onDelete(namespace);
        });
        actions.appendChild(remove);

        header.appendChild(actions);
        card.appendChild(header);
        container.appendChild(card);
    });
}

// ParseCommaList returns trimmed comma-separated values.
function ParseCommaList(value: string): string[] {
    return value.split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
}

// GetNamespacesEndpoint builds the endpoint used to fetch currently active namespace names.
function GetNamespacesEndpoint(): string {
    return NamespaceEndpoint;
}

// NormalizeNamespaceInput converts raw text into the backend namespace shape.
function NormalizeNamespaceInput(value: string): string {
    return value.trim().toLowerCase();
}

// IsValidNamespace checks the UI input against the backend namespace rule.
function IsValidNamespace(namespace: string): boolean {
    return NamespacePattern.test(namespace);
}

// GetNamespaceURL returns the URL that should be used after switching namespaces.
function GetNamespaceURL(namespace: string): URL {
    const nextURL = new URL(window.location.href);
    // Namespace switches should start from a clean filter state.
    nextURL.searchParams.delete('tag');
    nextURL.searchParams.delete('term');
    if (query.IsDefaultNamespace(namespace)) {
        nextURL.searchParams.delete('namespace');
    } else {
        nextURL.searchParams.set('namespace', namespace);
    }
    return nextURL;
}

// GetNoteCreateURL returns the standalone authoring URL for a namespace.
function GetNoteCreateURL(namespace: string, focusNamespace: boolean = false): string {
    const nextURL = new URL('/note', window.location.origin);
    nextURL.searchParams.set('mode', 'create');
    nextURL.searchParams.set('namespace', namespace);
    if (focusNamespace) {
        nextURL.searchParams.set('focus', 'namespace');
    }
    return nextURL.toString();
}

// GetVisibleNamespaces keeps the selected namespace visible while capping tab count.
function GetVisibleNamespaces(availableNamespaces: string[], currentNamespace: string): string[] {
    if (availableNamespaces.length <= NamespaceSearchThreshold) {
        return availableNamespaces;
    }

    const visible = availableNamespaces.slice(0, NamespaceSearchThreshold);
    if (visible.includes(currentNamespace)) {
        return visible;
    }

    visible[visible.length - 1] = currentNamespace;
    return visible.sort((a, b) => a.localeCompare(b));
}

// NamespaceMatches applies a lightweight fuzzy match for namespace finder results.
function NamespaceMatches(namespace: string, term: string): boolean {
    const normalizedNamespace = namespace.toLowerCase();
    const normalizedTerm = term.toLowerCase();
    if (!normalizedTerm || normalizedNamespace.includes(normalizedTerm)) {
        return true;
    }

    let termIndex = 0;
    for (const char of normalizedNamespace) {
        if (char === normalizedTerm[termIndex]) {
            termIndex++;
            if (termIndex === normalizedTerm.length) {
                return true;
            }
        }
    }

    return false;
}

// IsAdminSessionActive returns whether the UI currently has an admin session.
function IsAdminSessionActive(): boolean {
    return document.body.classList.contains('is-admin');
}

// RenderNamespaceFinder opens a searchable namespace picker with optional create support.
function RenderNamespaceFinder(
    finder: HTMLElement,
    availableNamespaces: string[],
    mode: 'find' | 'create',
    onSelect: (namespace: string) => Promise<void>,
    onCreate: (namespace: string) => void
): void {
    const allowCreate = IsAdminSessionActive();
    const closeFinder = () => {
        finder.classList.add('is-hidden');
        finder.innerHTML = '';
    };

    finder.classList.remove('is-hidden');
    finder.innerHTML = '';

    const bar = document.createElement('div');
    bar.className = 'namespace-finder__bar';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'namespace-finder__input';
    input.placeholder = mode === 'create' ? 'new-namespace' : allowCreate ? 'Find or create namespace' : 'Find namespace';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', mode === 'create' ? 'New namespace name' : 'Find namespace');

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'namespace-finder__close';
    closeButton.setAttribute('aria-label', 'Close namespace finder');
    closeButton.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
    closeButton.addEventListener('click', closeFinder);

    const list = document.createElement('div');
    list.className = 'namespace-finder__list';
    list.setAttribute('role', 'listbox');

    const selectNamespace = async (namespace: string) => {
        closeFinder();
        await onSelect(namespace);
    };

    const createNamespace = (namespace: string) => {
        closeFinder();
        onCreate(namespace);
    };

    const renderResults = () => {
        const term = NormalizeNamespaceInput(input.value);
        const matchingNamespaces = availableNamespaces
            .filter((namespace) => NamespaceMatches(namespace, term))
            .slice(0, 12);
        const exactMatch = availableNamespaces.includes(term);

        list.innerHTML = '';

        if (allowCreate && term && IsValidNamespace(term) && !exactMatch) {
            const createItem = document.createElement('button');
            createItem.type = 'button';
            createItem.className = 'namespace-finder__item namespace-finder__item--create';

            const createLabel = document.createElement('span');
            createLabel.textContent = term;

            const createHint = document.createElement('small');
            createHint.textContent = 'Add note';

            createItem.append(createLabel, createHint);
            createItem.addEventListener('click', () => {
                createNamespace(term);
            });
            list.appendChild(createItem);
        }

        matchingNamespaces.forEach((namespace) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'namespace-finder__item';
            item.setAttribute('role', 'option');

            const label = document.createElement('span');
            label.textContent = namespace;

            const hint = document.createElement('small');
            hint.textContent = 'Open';

            item.append(label, hint);
            item.addEventListener('click', () => {
                selectNamespace(namespace);
            });
            list.appendChild(item);
        });

        if (!list.childElementCount) {
            const empty = document.createElement('p');
            empty.className = 'namespace-finder__empty';
            empty.textContent = term && !IsValidNamespace(term)
                ? 'Use lowercase letters, numbers, and hyphens. Names must start and end with a letter or number.'
                : 'No namespaces found.';
            list.appendChild(empty);
        }
    };

    input.addEventListener('input', renderResults);
    input.addEventListener('keydown', async (event) => {
        if (event.key === 'Escape') {
            closeFinder();
            return;
        }

        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        const term = NormalizeNamespaceInput(input.value);
        if (availableNamespaces.includes(term)) {
            await selectNamespace(term);
            return;
        }
        if (allowCreate && IsValidNamespace(term)) {
            createNamespace(term);
        }
    });

    bar.append(input, closeButton);
    finder.append(bar, list);

    if (mode === 'find') {
        renderResults();
    } else {
        const empty = document.createElement('p');
        empty.className = 'namespace-finder__empty';
        empty.textContent = allowCreate ? 'Type a namespace name to add its first note.' : 'Sign in as admin to create namespaces.';
        list.appendChild(empty);
    }

    requestAnimationFrame(() => input.focus());
}

// ApplyNamespaceColor styles one namespace tab with its optional custom color.
function ApplyNamespaceColor(tab: HTMLElement, color?: string | null): void {
    const normalizedColor = color?.toLowerCase() || '';
    const hasCustomColor = NamespaceColorPattern.test(normalizedColor);
    tab.classList.toggle('namespace-tab--colored', hasCustomColor);
    if (hasCustomColor) {
        tab.style.setProperty('--namespace-color', normalizedColor);
        return;
    }
    tab.style.removeProperty('--namespace-color');
}

// ApplyNamespaceColorToTabs updates currently rendered tabs for one namespace.
function ApplyNamespaceColorToTabs(namespace: string, color: string | null): void {
    document.querySelectorAll<HTMLElement>('.namespace-tab[data-namespace]').forEach((tab) => {
        if (tab.dataset.namespace === namespace) {
            ApplyNamespaceColor(tab, color);
        }
    });
}

// SetupNamespaceSelector loads namespaces, applies cached/default selection, and reacts to user changes.
async function SetupNamespaceSelector(onSwitch?: NamespaceSwitchHandler): Promise<void> {
    const namespaceList = document.getElementById(NamespaceListId) as HTMLElement | null;
    const namespaceFinder = document.getElementById(NamespaceFinderId) as HTMLElement | null;
    if (!namespaceList) {
        return;
    }

    const availableNamespaces = await GetNamespaces();
    const namespaceColors = GetNamespaceColors();
    const currentNamespace = query.GetSelectedNamespace();
    const noteCreateLink = document.getElementById('noteComposerToggle') as HTMLAnchorElement | null;
    if (noteCreateLink) {
        noteCreateLink.href = GetNoteCreateURL(currentNamespace);
    }

    if (availableNamespaces.length === 0) {
        availableNamespaces.push(currentNamespace);
    }

    if (!availableNamespaces.includes(currentNamespace)) {
        availableNamespaces.push(currentNamespace);
    }

    availableNamespaces.sort((a, b) => a.localeCompare(b));

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

    namespaceList.innerHTML = '';
    if (namespaceFinder) {
        namespaceFinder.classList.add('is-hidden');
        namespaceFinder.innerHTML = '';
    }
    namespaceList.setAttribute('role', 'tablist');
    namespaceList.setAttribute('aria-label', 'Namespaces');
    let switchingNamespace = false;
    const visibleNamespaces = GetVisibleNamespaces(availableNamespaces, currentNamespace);
    const hasOverflow = visibleNamespaces.length < availableNamespaces.length;

    const selectNamespace = async (namespace: string, button?: HTMLButtonElement) => {
        if (namespace === currentNamespace || switchingNamespace) {
            return;
        }

        switchingNamespace = true;
        query.SetSelectedNamespace(namespace);
        namespaceList.querySelectorAll('.namespace-tab').forEach((tab) => {
            tab.setAttribute('aria-selected', 'false');
            tab.setAttribute('aria-current', 'false');
            (tab as HTMLButtonElement).disabled = true;
        });
        if (button) {
            button.setAttribute('aria-selected', 'true');
            button.setAttribute('aria-current', 'page');
            button.classList.add('namespace-tab--loading');
        }
        document.body.classList.add('namespace-switching');

        try {
            const nextURL = GetNamespaceURL(namespace);
            if (onSwitch) {
                await onSwitch(namespace, nextURL);
            } else {
                window.location.assign(nextURL.toString());
            }
        } catch (err) {
            console.error(err);
            switchingNamespace = false;
            document.body.classList.remove('namespace-switching');
            await SetupNamespaceSelector(onSwitch);
        }
    };

    const openAddNoteInNamespace = (namespace: string) => {
        window.location.assign(GetNoteCreateURL(namespace));
    };

    const openAddNoteNamespacePicker = () => {
        window.location.assign(GetNoteCreateURL(query.GetSelectedNamespace(), true));
    };

    const createNamespaceButton = (namespace: string): HTMLButtonElement => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'namespace-tab';
        button.dataset.namespace = namespace;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(namespace === currentNamespace));
        button.setAttribute('aria-current', namespace === currentNamespace ? 'page' : 'false');
        ApplyNamespaceColor(button, namespaceColors[namespace]);

        const namespaceText = document.createElement('span');
        namespaceText.className = 'namespace-tab__text';
        namespaceText.textContent = namespace;
        namespaceText.title = namespace;

        button.appendChild(namespaceText);
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            await selectNamespace(namespace, button);
        });

        return button;
    };

    visibleNamespaces.forEach((namespace) => {
        namespaceList.appendChild(createNamespaceButton(namespace));
    });

    if (namespaceFinder && hasOverflow) {
        const hiddenNamespaceCount = availableNamespaces.length - visibleNamespaces.length;
        const finderButton = document.createElement('button');
        finderButton.type = 'button';
        finderButton.className = 'namespace-tab namespace-tab--utility';
        finderButton.setAttribute('aria-label', `Find ${hiddenNamespaceCount} more ${hiddenNamespaceCount === 1 ? 'namespace' : 'namespaces'}`);
        finderButton.title = `Find ${hiddenNamespaceCount} more ${hiddenNamespaceCount === 1 ? 'namespace' : 'namespaces'}`;
        finderButton.innerHTML = '<i class="bi bi-search" aria-hidden="true"></i>';
        finderButton.addEventListener('click', () => {
            RenderNamespaceFinder(namespaceFinder, availableNamespaces, 'find', selectNamespace, openAddNoteInNamespace);
        });
        namespaceList.appendChild(finderButton);
    }

    if (namespaceFinder) {
        const createButton = document.createElement('button');
        createButton.type = 'button';
        createButton.className = 'namespace-tab namespace-tab--utility namespace-tab--create admin-only';
        createButton.setAttribute('aria-label', 'Add note to namespace');
        createButton.innerHTML = '<i class="bi bi-plus-lg" aria-hidden="true"></i>';
        createButton.addEventListener('click', () => {
            openAddNoteNamespacePicker();
        });
        namespaceList.appendChild(createButton);
    }
}

// Fetch main data with cache validation and update the global store.
async function QueryMainData() {
    const queryPath = query.GetQueryPath();
    const noteCacheEnabled = cache.isNoteCacheEnabled();
    
    // Check if we have valid cached data for this query path
    console.log('Cache lookup for path:', queryPath, 'Cache size:', cache.getCacheSize(), 'Cache keys:', cache.getCacheKeys());
    const cachedEntry = noteCacheEnabled ? cache.getCacheEntry(queryPath) : undefined;
    
    console.log('Cache entry retrieved:', cachedEntry);
    if (noteCacheEnabled && cache.isCacheValid(cachedEntry)) {
        // The `!` is TypeScript's non-null assertion operator. It tells TypeScript that `cachedEntry` is definitely not null/undefined
        // at this point, even though `getCacheEntry()` returns `CacheEntry<CartoResponse> | undefined`. We can safely use `!` here because `isCacheValid()` 
        // returns false if the cache entry is null/undefined, so we know it exists when we reach this line.
        CartographerData = cachedEntry!.data;
        console.log('Using cached data:', CartographerData);
        return;
    }

    try {
        const response = await fetch(queryPath, {
            ...EncodingHeader,
            cache: noteCacheEnabled ? 'default' : 'no-store',
        });
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

    // Bail if required DOM nodes are missing.
    if (!metaRow || !tagsContainer) {
        return;
    }

    // Count tag occurrences across all cards.
    const tagFrequency = new Map<string, number>();
    const availableCards = cardsList || [];
    availableCards.forEach(card => {
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
        siteName.setAttribute('title', `${availableCards.length} notes \u2022 ${tagFrequency.size} tags`);
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
    const buildBase = (container: HTMLElement, iconClass: string, labelText: string, collapsed: boolean) => {
        container.innerHTML = '';
        container.classList.toggle('nav-tags--collapsed', collapsed);
        const icon = document.createElement('i');
        icon.className = `${iconClass} nav-meta__icon`;
        const label = document.createElement('span');
        label.className = 'nav-meta__label';
        label.textContent = labelText;
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'nav-tags__toggle';
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.setAttribute('aria-controls', 'navMetaTags');
        toggle.innerHTML = collapsed
            ? '<i class="bi bi-chevron-right"></i>'
            : '<i class="bi bi-chevron-down"></i>';
        toggle.addEventListener('click', () => {
            SetTopTagsCollapsed(!collapsed);
            RenderNavMetadata(cardsList);
        });
        container.appendChild(icon);
        container.appendChild(label);
        container.appendChild(toggle);
        return { icon, label };
    };

    // Pick the top tags by count (then name).
    const topTags = [...tagFrequency.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const topTagsCollapsed = GetTopTagsCollapsed();

    buildBase(tagsContainer, 'bi bi-tags', 'Top tags', topTagsCollapsed);

    if (topTagsCollapsed) {
        const summary = document.createElement('span');
        summary.className = 'nav-tags__summary';
        summary.textContent = `${topTags.length} tags`;
        tagsContainer.appendChild(summary);
    }

    // Render empty state if there are no tags.
    if (!topTagsCollapsed && topTags.length === 0) {
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

    if (!topTagsCollapsed) {
        topTags.forEach(([tag, count]) => renderTagButton(tag, count));
    }

    // Ensure the metadata row is visible once populated and animate it in.
    metaRow.classList.remove('is-hidden');
    metaRow.classList.remove(SKELETON_CLASS);
    metaRow.classList.add(ENTER_CLASS);
    requestAnimationFrame(() => {
        metaRow.classList.remove(ENTER_CLASS);
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

// GetNamespaceColors reads validated namespace tab colors from browser storage.
export function GetNamespaceColors(): Record<string, string> {
    try {
        const stored = localStorage.getItem(NamespaceColorsStorageKey);
        if (!stored) {
            return {};
        }
        const colors = JSON.parse(stored) as Record<string, unknown>;

        return Object.fromEntries(Object.entries(colors).filter(([namespace, color]) => {
            return IsValidNamespace(namespace)
                && typeof color === 'string'
                && NamespaceColorPattern.test(color);
        })) as Record<string, string>;
    } catch (err) {
        console.error(err);
        return {};
    }
}

// SaveNamespaceColor updates one namespace color in browser storage.
export function SaveNamespaceColor(namespace: string, color: string | null): void {
    const colors = GetNamespaceColors();
    if (color && NamespaceColorPattern.test(color)) {
        colors[namespace] = color;
    } else {
        delete colors[namespace];
    }
    localStorage.setItem(NamespaceColorsStorageKey, JSON.stringify(colors));
}
