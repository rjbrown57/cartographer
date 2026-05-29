import * as dropdown from '../components/dropDown.js';
import { Note, RenderMarkdown } from '../cards/notes.js';
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
const NamespaceEndpoint = query.GetEndpoint + '/namespaces';
const NotesEndpoint = '/v1/notes';
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
        SetupNoteSubmission();
        this.Initialize();
    }
    async Initialize() {
        await SetupNamespaceSelector();
        await QueryMainData();
        if (!CartographerData || !Array.isArray(CartographerData.notes)) {
            console.error('No notes data available to render');
            RenderNavMetadata([]);
            return;
        }
        CartographerData.notes.forEach((note) => {
            const resolvedID = note.id || note.url || note.title;
            if (!resolvedID) {
                return;
            }
            const resolvedURL = note.url || '';
            const resolvedTitle = note.title || resolvedURL || resolvedID;
            const resolvedBody = note.body || resolvedURL || '';
            const resolvedTags = Array.isArray(note.tags) ? note.tags : [];
            this.Cards.push(new Note(resolvedID, resolvedTitle, resolvedBody, resolvedURL, resolvedTags, note.data));
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
function SetupNoteSubmission() {
    const form = document.getElementById('noteForm');
    const status = document.getElementById('noteFormStatus');
    const composer = document.getElementById('noteComposer');
    const toggle = document.getElementById('noteComposerToggle');
    const close = document.getElementById('noteComposerClose');
    const noteID = document.getElementById('noteID');
    const titleInput = document.getElementById('noteTitle');
    const urlInput = document.getElementById('noteURL');
    const bodyInput = document.getElementById('noteBody');
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
    const setComposerOpen = (open) => {
        if (!composer || !toggle) {
            return;
        }
        composer.classList.toggle('is-hidden', !open);
        document.body.classList.toggle('modal-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.classList.toggle('nav-action--active', open);
        if (open) {
            titleInput?.focus();
        }
    };
    const setCreateMode = () => {
        if (noteID) {
            noteID.value = '';
        }
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
            setCreateMode();
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
    }));
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const existingID = noteID?.value.trim() || '';
        const title = titleInput?.value.trim() || '';
        const url = urlInput?.value.trim() || '';
        const body = bodyInput?.value.trim() || '';
        const tags = parseTags();
        if (!title || !body) {
            if (status) {
                status.textContent = 'Title and markdown body are required.';
                status.className = 'note-form-status text-danger';
            }
            return;
        }
        const payload = {
            id: existingID || crypto.randomUUID(),
            title,
            body,
            url,
            tags,
            namespace: query.GetSelectedNamespace(),
        };
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
            setCreateMode();
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
        siteName.setAttribute('title', `${cardsList.length} notes \u2022 ${tagFrequency.size} tags`);
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
