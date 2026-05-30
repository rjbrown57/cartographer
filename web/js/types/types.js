import { Note, RenderMarkdown } from '../cards/notes.js';
import { SearchBar, TagFilter } from '../components/searchBar.js';
import * as cache from '../components/cache.js';
import * as query from '../query/query.js';
const EncodingHeader = {
    headers: {
        'Accept-Encoding': 'gzip'
    }
};
let CartographerData;
const NamespaceEndpoint = query.GetEndpoint + '/namespaces';
const NotesEndpoint = '/v1/notes';
const NamespaceListId = 'namespaceList';
const NamespaceFinderId = 'namespaceFinder';
const MaxVisibleNamespaceTabs = 8;
const NamespacePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TopTagsCollapsedStorageKey = 'cartographer_top_tags_collapsed';
export class Cartographer {
    Cards = [];
    SearchBar;
    renderVersion = 0;
    constructor() {
        this.SearchBar = new SearchBar(this.Cards);
        SetupNoteSubmission();
        this.Initialize();
    }
    async Initialize() {
        await SetupNamespaceSelector(this.SwitchNamespace.bind(this));
        await this.LoadCurrentNamespace();
    }
    async LoadCurrentNamespace() {
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
            this.Cards.push(new Note(resolvedID, resolvedTitle, resolvedBody, resolvedURL, resolvedTags, note.data, {
                created_at: note.created_at,
                updated_at: note.updated_at,
                source: note.source,
                author: note.author,
                version: note.version,
            }));
        });
        RenderNavMetadata(this.Cards);
        this.renderCards();
    }
    async SwitchNamespace(namespace, nextURL) {
        try {
            window.history.pushState({}, '', nextURL.toString());
            query.SetSelectedNamespace(namespace);
            document.body.classList.add('namespace-switching');
            const searchElement = document.getElementById('searchBar');
            if (searchElement) {
                searchElement.value = '';
            }
            await SetupNamespaceSelector(this.SwitchNamespace.bind(this));
            await this.LoadCurrentNamespace();
        }
        finally {
            requestAnimationFrame(() => {
                document.body.classList.remove('namespace-switching');
            });
        }
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
        const currentRenderVersion = ++this.renderVersion;
        container.innerHTML = '';
        const urlParams = new URLSearchParams(window.location.search);
        const hasSearchParams = urlParams.has('tag') || urlParams.has('term');
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
                if (currentRenderVersion !== this.renderVersion) {
                    return;
                }
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
function GetTopTagsCollapsed() {
    return localStorage.getItem(TopTagsCollapsedStorageKey) === 'true';
}
function SetTopTagsCollapsed(collapsed) {
    localStorage.setItem(TopTagsCollapsedStorageKey, String(collapsed));
}
function SetupNoteSubmission() {
    const form = document.getElementById('noteForm');
    const status = document.getElementById('noteFormStatus');
    const composer = document.getElementById('noteComposer');
    const toggle = document.getElementById('noteComposerToggle');
    const close = document.getElementById('noteComposerClose');
    const noteID = document.getElementById('noteID');
    const noteCreatedAt = document.getElementById('noteCreatedAt');
    const noteUpdatedAt = document.getElementById('noteUpdatedAt');
    const noteVersion = document.getElementById('noteVersion');
    const titleInput = document.getElementById('noteTitle');
    const urlInput = document.getElementById('noteURL');
    const sourceInput = document.getElementById('noteSource');
    const authorInput = document.getElementById('noteAuthor');
    const namespaceInput = document.getElementById('noteNamespace');
    const namespaceOptions = document.getElementById('noteNamespaceOptions');
    const bodyInput = document.getElementById('noteBody');
    const dataDetails = document.getElementById('noteDataDetails');
    const dataInput = document.getElementById('noteData');
    const tagsInput = document.getElementById('noteTags');
    const tagsPreview = document.getElementById('noteTagPreview');
    const writeTab = document.getElementById('noteWriteTab');
    const previewTab = document.getElementById('notePreviewTab');
    const previewPane = document.getElementById('notePreview');
    const modeLabel = document.getElementById('noteComposerModeLabel');
    const submitLabel = document.getElementById('noteSubmitLabel');
    if (!form) {
        return;
    }
    const parseTags = () => {
        const tagsValue = tagsInput?.value.trim() || '';
        return tagsValue.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag !== '');
    };
    const parseDataInput = () => {
        const dataValue = dataInput?.value.trim() || '';
        if (!dataValue) {
            return null;
        }
        try {
            const parsed = JSON.parse(dataValue);
            if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
                throw new Error('Data must be a JSON object.');
            }
            return parsed;
        }
        catch (err) {
            console.error(err);
            if (status) {
                status.textContent = 'Data must be valid JSON object syntax.';
                status.className = 'note-form-status text-danger';
            }
            dataDetails?.setAttribute('open', '');
            dataInput?.focus();
            return null;
        }
    };
    const normalizeTimestampValue = (value) => {
        if (!value) {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }
        const seconds = Number(value.seconds || 0);
        const nanos = Number(value.nanos || 0);
        if (!seconds && !nanos) {
            return '';
        }
        return new Date((seconds * 1000) + Math.floor(nanos / 1_000_000)).toISOString();
    };
    const setDataValue = (data) => {
        if (!dataInput) {
            return;
        }
        const hasData = data && Object.keys(data).length > 0;
        dataInput.value = hasData ? JSON.stringify(data, null, 2) : '';
        dataDetails?.toggleAttribute('open', Boolean(hasData));
    };
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
    const populateNamespaceOptions = async (selectedNamespace) => {
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
    const setNamespaceValue = (namespace) => {
        if (!namespaceInput) {
            return;
        }
        namespaceInput.value = NormalizeNamespaceInput(namespace || query.GetSelectedNamespace());
        void populateNamespaceOptions(namespaceInput.value);
    };
    const updatePreview = () => {
        if (!previewPane || !bodyInput) {
            return;
        }
        const markdown = bodyInput.value.trim();
        previewPane.innerHTML = markdown
            ? RenderMarkdown(markdown)
            : '<p class="text-secondary mb-0">Markdown preview will appear here.</p>';
    };
    const setEditorMode = (mode) => {
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
    const setComposerOpen = (open, focusNamespace = false) => {
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
            }
            else {
                titleInput?.focus();
            }
        }
    };
    const setCreateMode = (namespace = query.GetSelectedNamespace()) => {
        if (noteID) {
            noteID.value = '';
        }
        if (noteCreatedAt) {
            noteCreatedAt.value = '';
        }
        if (noteUpdatedAt) {
            noteUpdatedAt.value = '';
        }
        if (noteVersion) {
            noteVersion.value = '';
        }
        if (namespaceInput) {
            namespaceInput.disabled = false;
        }
        setNamespaceValue(namespace);
        setDataValue();
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
    document.addEventListener('cartographer:edit-note', ((event) => {
        const detail = event.detail;
        if (!detail) {
            return;
        }
        if (noteID) {
            noteID.value = detail.id;
        }
        if (noteCreatedAt) {
            noteCreatedAt.value = normalizeTimestampValue(detail.metadata?.created_at);
        }
        if (noteUpdatedAt) {
            noteUpdatedAt.value = normalizeTimestampValue(detail.metadata?.updated_at);
        }
        if (noteVersion) {
            noteVersion.value = String(detail.metadata?.version || '');
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
        if (sourceInput) {
            sourceInput.value = detail.metadata?.source || '';
        }
        if (authorInput) {
            authorInput.value = detail.metadata?.author || '';
        }
        if (bodyInput) {
            bodyInput.value = detail.body;
        }
        setDataValue(detail.data);
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
    }));
    document.addEventListener('cartographer:add-note', ((event) => {
        const detail = event.detail;
        form.reset();
        setCreateMode(detail?.namespace || query.GetSelectedNamespace());
        setComposerOpen(true, Boolean(detail?.focusNamespace));
    }));
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const existingID = noteID?.value.trim() || '';
        const title = titleInput?.value.trim() || '';
        const url = urlInput?.value.trim() || '';
        const source = sourceInput?.value.trim() || '';
        const author = authorInput?.value.trim() || '';
        const body = bodyInput?.value.trim() || '';
        const tags = parseTags();
        const namespace = NormalizeNamespaceInput(namespaceInput?.value || query.GetSelectedNamespace());
        const data = parseDataInput();
        const hasDataInput = Boolean(dataInput?.value.trim());
        if (hasDataInput && !data) {
            return;
        }
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
            data: data || undefined,
            namespace,
            created_at: noteCreatedAt?.value || undefined,
            updated_at: undefined,
            source: source || undefined,
            author: author || undefined,
            version: undefined,
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
        }
        catch (err) {
            console.error(err);
            if (status) {
                status.textContent = 'Unable to save note.';
                status.className = 'note-form-status text-danger';
            }
        }
    });
}
function GetNamespacesEndpoint() {
    return NamespaceEndpoint;
}
function NormalizeNamespaceInput(value) {
    return value.trim().toLowerCase();
}
function IsValidNamespace(namespace) {
    return NamespacePattern.test(namespace);
}
function GetNamespaceURL(namespace) {
    const nextURL = new URL(window.location.href);
    nextURL.searchParams.delete('tag');
    nextURL.searchParams.delete('term');
    if (query.IsDefaultNamespace(namespace)) {
        nextURL.searchParams.delete('namespace');
    }
    else {
        nextURL.searchParams.set('namespace', namespace);
    }
    return nextURL;
}
function GetVisibleNamespaces(availableNamespaces, currentNamespace) {
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
function NamespaceMatches(namespace, term) {
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
function RenderNamespaceFinder(finder, availableNamespaces, mode, onSelect, onCreate) {
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
    const selectNamespace = async (namespace) => {
        closeFinder();
        await onSelect(namespace);
    };
    const createNamespace = (namespace) => {
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
    }
    else {
        const empty = document.createElement('p');
        empty.className = 'namespace-finder__empty';
        empty.textContent = 'Type a namespace name to add its first note.';
        list.appendChild(empty);
    }
    requestAnimationFrame(() => input.focus());
}
async function SetupNamespaceSelector(onSwitch) {
    const namespaceList = document.getElementById(NamespaceListId);
    const namespaceFinder = document.getElementById(NamespaceFinderId);
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
    }
    else if (namespaceParam && query.IsDefaultNamespace(currentNamespace)) {
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
    const selectNamespace = async (namespace, button) => {
        if (namespace === currentNamespace || switchingNamespace) {
            return;
        }
        switchingNamespace = true;
        query.SetSelectedNamespace(namespace);
        namespaceList.querySelectorAll('.namespace-tab').forEach((tab) => {
            tab.setAttribute('aria-selected', 'false');
            tab.setAttribute('aria-current', 'false');
            tab.disabled = true;
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
            }
            else {
                window.location.assign(nextURL.toString());
            }
        }
        catch (err) {
            console.error(err);
            switchingNamespace = false;
            document.body.classList.remove('namespace-switching');
            await SetupNamespaceSelector(onSwitch);
        }
    };
    const openAddNoteInNamespace = (namespace) => {
        document.dispatchEvent(new CustomEvent('cartographer:add-note', {
            detail: { namespace, focusNamespace: false },
        }));
    };
    const openAddNoteNamespacePicker = () => {
        document.dispatchEvent(new CustomEvent('cartographer:add-note', {
            detail: { namespace: query.GetSelectedNamespace(), focusNamespace: true },
        }));
    };
    const createNamespaceButton = (namespace) => {
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
    if (!metaRow || !tagsContainer) {
        return;
    }
    const tagFrequency = new Map();
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
    const buildBase = (container, iconClass, labelText, collapsed) => {
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
    if (!topTagsCollapsed && topTags.length === 0) {
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
    if (!topTagsCollapsed) {
        topTags.forEach(([tag, count]) => renderTagButton(tag, count));
    }
    metaRow.classList.remove('is-hidden');
    metaRow.classList.remove(SKELETON_CLASS);
    metaRow.classList.add(ENTER_CLASS);
    requestAnimationFrame(() => {
        metaRow.classList.remove(ENTER_CLASS);
    });
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
