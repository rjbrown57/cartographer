import * as cards from '../cards/cards.js';
import { Note, RenderMarkdown } from '../cards/notes.js';
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
const NotesEndpoint = '/v1/notes';
const NamespaceListId = 'namespaceList'
const NamespaceFinderId = 'namespaceFinder'
const MaxVisibleNamespaceTabs = 8;
const NamespacePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TopTagsCollapsedStorageKey = 'cartographer_top_tags_collapsed';

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
}

type NoteEditEvent = CustomEvent<{
    id: string;
    title: string;
    body: string;
    url: string;
    tags: string[];
}>;

type NoteComposeEvent = CustomEvent<{
    namespace?: string;
    focusNamespace?: boolean;
}>;

type NamespaceSwitchHandler = (namespace: string, nextURL: URL) => Promise<void>;

// Cartographer class is used to represent a collection of cards
// move to it's own file
export class Cartographer {
    Cards: cards.Card[] = [];
    SearchBar: SearchBar;
    private renderVersion: number = 0;
    // Initialize data, build cards, and wire up UI controls.
    constructor() {
        this.SearchBar = new SearchBar(this.Cards);
        SetupViewToggle();
        SetupNoteSubmission();
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

        if (!CartographerData || !Array.isArray(CartographerData.notes)) {
            console.error('No notes data available to render');
            RenderNavMetadata([]);
            return;
        }

        this.Cards.splice(0, this.Cards.length);
        CartographerData.notes.forEach((note) => {
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
                    note.data
                )
            );
        });

        RenderNavMetadata(this.Cards);
        this.renderCards();
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

// GetTopTagsCollapsed returns whether the top tags row should render collapsed.
function GetTopTagsCollapsed(): boolean {
    return localStorage.getItem(TopTagsCollapsedStorageKey) === 'true';
}

// SetTopTagsCollapsed persists whether the top tags row should render collapsed.
function SetTopTagsCollapsed(collapsed: boolean): void {
    localStorage.setItem(TopTagsCollapsedStorageKey, String(collapsed));
}

// SetupNoteSubmission wires the note form to the live backend endpoint.
function SetupNoteSubmission(): void {
    const form = document.getElementById('noteForm') as HTMLFormElement | null;
    const status = document.getElementById('noteFormStatus') as HTMLElement | null;
    const composer = document.getElementById('noteComposer') as HTMLElement | null;
    const toggle = document.getElementById('noteComposerToggle') as HTMLButtonElement | null;
    const close = document.getElementById('noteComposerClose') as HTMLButtonElement | null;
    const noteID = document.getElementById('noteID') as HTMLInputElement | null;
    const titleInput = document.getElementById('noteTitle') as HTMLInputElement | null;
    const urlInput = document.getElementById('noteURL') as HTMLInputElement | null;
    const namespaceInput = document.getElementById('noteNamespace') as HTMLInputElement | null;
    const namespaceOptions = document.getElementById('noteNamespaceOptions') as HTMLDataListElement | null;
    const bodyInput = document.getElementById('noteBody') as HTMLTextAreaElement | null;
    const tagsInput = document.getElementById('noteTags') as HTMLInputElement | null;
    const tagsPreview = document.getElementById('noteTagPreview') as HTMLElement | null;
    const writeTab = document.getElementById('noteWriteTab') as HTMLButtonElement | null;
    const previewTab = document.getElementById('notePreviewTab') as HTMLButtonElement | null;
    const previewPane = document.getElementById('notePreview') as HTMLElement | null;
    const modeLabel = document.getElementById('noteComposerModeLabel') as HTMLElement | null;
    const submitLabel = document.getElementById('noteSubmitLabel') as HTMLElement | null;
    if (!form) {
        return;
    }

    // parseTags converts the composer tag input into normalized tag values.
    const parseTags = (): string[] => {
        const tagsValue = tagsInput?.value.trim() || '';
        return tagsValue.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag !== '');
    };

    // syncTagPreview renders live chips from the current tag input.
    const syncTagPreview = () => {
        if (!tagsPreview) {
            return;
        }

        tagsPreview.innerHTML = '';
        parseTags().forEach((tag) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'note-tag-chip';
            const label = document.createElement('span');
            label.textContent = tag;
            const icon = document.createElement('i');
            icon.className = 'bi bi-x';
            chip.appendChild(label);
            chip.appendChild(icon);
            chip.addEventListener('click', () => {
                const remainingTags = parseTags().filter(candidate => candidate !== tag);
                if (tagsInput) {
                    tagsInput.value = remainingTags.join(', ');
                }
                syncTagPreview();
            });
            tagsPreview.appendChild(chip);
        });
    };

    // populateNamespaceOptions refreshes namespace suggestions for the note form.
    const populateNamespaceOptions = async (selectedNamespace: string) => {
        if (!namespaceOptions) {
            return;
        }

        const namespaces = await GetNamespaces();
        const selected = NormalizeNamespaceInput(selectedNamespace || query.GetSelectedNamespace());
        if (selected && !namespaces.includes(selected)) {
            namespaces.push(selected);
        }
        namespaces.sort((a, b) => a.localeCompare(b));

        namespaceOptions.innerHTML = '';
        namespaces.forEach((namespace) => {
            const option = document.createElement('option');
            option.value = namespace;
            namespaceOptions.appendChild(option);
        });
    };

    // setNamespaceValue writes a normalized namespace into the note form.
    const setNamespaceValue = (namespace: string) => {
        if (!namespaceInput) {
            return;
        }

        namespaceInput.value = NormalizeNamespaceInput(namespace || query.GetSelectedNamespace());
        void populateNamespaceOptions(namespaceInput.value);
    };

    // updatePreview refreshes the rendered markdown preview pane.
    const updatePreview = () => {
        if (!previewPane || !bodyInput) {
            return;
        }

        const markdown = bodyInput.value.trim();
        previewPane.innerHTML = markdown
            ? RenderMarkdown(markdown)
            : '<p class="text-secondary mb-0">Markdown preview will appear here.</p>';
    };

    // setEditorMode switches the composer between writing and previewing markdown.
    const setEditorMode = (mode: 'write' | 'preview') => {
        const isPreview = mode === 'preview';
        bodyInput?.classList.toggle('is-hidden', isPreview);
        previewPane?.classList.toggle('is-hidden', !isPreview);
        writeTab?.classList.toggle('note-editor-tab--active', !isPreview);
        previewTab?.classList.toggle('note-editor-tab--active', isPreview);
        writeTab?.setAttribute('aria-pressed', String(!isPreview));
        previewTab?.setAttribute('aria-pressed', String(isPreview));
        if (isPreview) {
            updatePreview();
        }
    };

    const setComposerOpen = (open: boolean, focusNamespace = false) => {
        if (!composer || !toggle) {
            return;
        }

        composer.classList.toggle('is-hidden', !open);
        document.body.classList.toggle('modal-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.classList.toggle('nav-action--active', open);

        if (open) {
            if (focusNamespace) {
                namespaceInput?.focus();
                namespaceInput?.select();
            } else {
                titleInput?.focus();
            }
        }
    };

    const setCreateMode = (namespace = query.GetSelectedNamespace()) => {
        if (noteID) {
            noteID.value = '';
        }
        if (namespaceInput) {
            namespaceInput.disabled = false;
        }
        setNamespaceValue(namespace);
        if (submitLabel) {
            submitLabel.textContent = 'Save note';
        }
        if (modeLabel) {
            modeLabel.textContent = 'Add note';
        }
        if (status) {
            status.textContent = '';
            status.className = 'note-form-status';
        }
        syncTagPreview();
        updatePreview();
        setEditorMode('write');
    };

    bodyInput?.addEventListener('input', updatePreview);
    tagsInput?.addEventListener('input', syncTagPreview);
    writeTab?.addEventListener('click', () => setEditorMode('write'));
    previewTab?.addEventListener('click', () => setEditorMode('preview'));

    toggle?.addEventListener('click', () => {
        const isOpen = composer ? !composer.classList.contains('is-hidden') : false;
        if (!isOpen) {
            form.reset();
            setCreateMode(query.GetSelectedNamespace());
        }
        setComposerOpen(!isOpen);
    });

    close?.addEventListener('click', () => {
        setComposerOpen(false);
        toggle?.focus();
    });

    composer?.addEventListener('click', (event) => {
        if (event.target === composer) {
            setComposerOpen(false);
            toggle?.focus();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && composer && !composer.classList.contains('is-hidden')) {
            setComposerOpen(false);
            toggle?.focus();
        }
    });

    document.addEventListener('cartographer:edit-note', ((event: Event) => {
        const detail = (event as NoteEditEvent).detail;
        if (!detail) {
            return;
        }

        if (noteID) {
            noteID.value = detail.id;
        }
        if (namespaceInput) {
            namespaceInput.disabled = true;
        }
        setNamespaceValue(query.GetSelectedNamespace());
        if (titleInput) {
            titleInput.value = detail.title;
        }
        if (urlInput) {
            urlInput.value = detail.url;
        }
        if (bodyInput) {
            bodyInput.value = detail.body;
        }
        if (tagsInput) {
            tagsInput.value = detail.tags.join(', ');
        }
        if (submitLabel) {
            submitLabel.textContent = 'Save changes';
        }
        if (modeLabel) {
            modeLabel.textContent = 'Edit note';
        }
        if (status) {
            status.textContent = 'Editing existing note.';
            status.className = 'note-form-status text-secondary';
        }

        syncTagPreview();
        updatePreview();
        setEditorMode('write');
        setComposerOpen(true);
    }) as EventListener);

    document.addEventListener('cartographer:add-note', ((event: Event) => {
        const detail = (event as NoteComposeEvent).detail;
        form.reset();
        setCreateMode(detail?.namespace || query.GetSelectedNamespace());
        setComposerOpen(true, Boolean(detail?.focusNamespace));
    }) as EventListener);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const existingID = noteID?.value.trim() || '';
        const title = titleInput?.value.trim() || '';
        const url = urlInput?.value.trim() || '';
        const body = bodyInput?.value.trim() || '';
        const tags = parseTags();
        const namespace = NormalizeNamespaceInput(namespaceInput?.value || query.GetSelectedNamespace());

        if (!title || !body) {
            if (status) {
                status.textContent = 'Title and markdown body are required.';
                status.className = 'note-form-status text-danger';
            }
            return;
        }

        if (!IsValidNamespace(namespace)) {
            if (status) {
                status.textContent = 'Use a valid namespace: lowercase letters, numbers, and hyphens.';
                status.className = 'note-form-status text-danger';
            }
            namespaceInput?.focus();
            return;
        }

        if (namespaceInput) {
            namespaceInput.value = namespace;
        }

        const payload = {
            id: existingID || crypto.randomUUID(),
            title,
            body,
            url,
            tags,
            namespace,
        };
        const namespaceToOpen = namespace !== query.GetSelectedNamespace() ? namespace : '';

        if (status) {
            status.textContent = existingID ? 'Saving changes...' : 'Saving note...';
            status.className = 'note-form-status text-secondary';
        }

        try {
            const response = await fetch(NotesEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                throw new Error(`Save failed: ${response.status} ${response.statusText}`);
            }

            cache.invalidateCache();
            if (status) {
                status.textContent = existingID ? 'Changes saved.' : 'Note saved.';
                status.className = 'note-form-status text-success';
            }
            form.reset();
            setCreateMode(query.GetSelectedNamespace());
            if (namespaceToOpen) {
                query.SetSelectedNamespace(namespaceToOpen);
                window.location.assign(GetNamespaceURL(namespaceToOpen).toString());
                return;
            }
            window.location.reload();
        } catch (err) {
            console.error(err);
            if (status) {
                status.textContent = 'Unable to save note.';
                status.className = 'note-form-status text-danger';
            }
        }
    });
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

// GetVisibleNamespaces keeps the selected namespace visible while capping tab count.
function GetVisibleNamespaces(availableNamespaces: string[], currentNamespace: string): string[] {
    if (availableNamespaces.length <= MaxVisibleNamespaceTabs) {
        return availableNamespaces;
    }

    const visible = availableNamespaces.slice(0, MaxVisibleNamespaceTabs);
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

// RenderNamespaceFinder opens a searchable namespace picker with create support.
function RenderNamespaceFinder(
    finder: HTMLElement,
    availableNamespaces: string[],
    mode: 'find' | 'create',
    onSelect: (namespace: string) => Promise<void>,
    onCreate: (namespace: string) => void
): void {
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
    input.placeholder = mode === 'create' ? 'new-namespace' : 'Find or create namespace';
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

        if (term && IsValidNamespace(term) && !exactMatch) {
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
        if (IsValidNamespace(term)) {
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
        empty.textContent = 'Type a namespace name to add its first note.';
        list.appendChild(empty);
    }

    requestAnimationFrame(() => input.focus());
}

// SetupNamespaceSelector loads namespaces, applies cached/default selection, and reacts to user changes.
async function SetupNamespaceSelector(onSwitch?: NamespaceSwitchHandler): Promise<void> {
    const namespaceList = document.getElementById(NamespaceListId) as HTMLElement | null;
    const namespaceFinder = document.getElementById(NamespaceFinderId) as HTMLElement | null;
    if (!namespaceList) {
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
        document.dispatchEvent(new CustomEvent('cartographer:add-note', {
            detail: { namespace, focusNamespace: false },
        }));
    };

    const openAddNoteNamespacePicker = () => {
        document.dispatchEvent(new CustomEvent('cartographer:add-note', {
            detail: { namespace: query.GetSelectedNamespace(), focusNamespace: true },
        }));
    };

    const createNamespaceButton = (namespace: string): HTMLButtonElement => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'namespace-tab';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(namespace === currentNamespace));
        button.setAttribute('aria-current', namespace === currentNamespace ? 'page' : 'false');

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
        const finderButton = document.createElement('button');
        finderButton.type = 'button';
        finderButton.className = 'namespace-tab namespace-tab--utility';
        finderButton.setAttribute('aria-label', 'Find namespace');
        finderButton.innerHTML = '<i class="bi bi-search" aria-hidden="true"></i>';
        finderButton.addEventListener('click', () => {
            RenderNamespaceFinder(namespaceFinder, availableNamespaces, 'find', selectNamespace, openAddNoteInNamespace);
        });
        namespaceList.appendChild(finderButton);
    }

    if (namespaceFinder) {
        const createButton = document.createElement('button');
        createButton.type = 'button';
        createButton.className = 'namespace-tab namespace-tab--utility namespace-tab--create';
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
