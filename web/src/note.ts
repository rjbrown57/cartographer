import { RenderMarkdown } from './cards/notes.js';
import {
    DraftFingerprint,
    FormatData,
    IsValidNamespace,
    NormalizeNamespaceInput,
    NormalizeTimestamp,
    ParseCommaList,
    ParseDataValue,
    ResolveReturnPath,
    type NoteData,
    type NoteDraft,
} from './noteEditor.js';

type CartoResponse = {
    response?: {
        notes?: NoteData[];
    };
};

type AdminSessionResponse = {
    admin: boolean;
    configured: boolean;
};

type MarkdownTemplate = {
    id: string;
    name: string;
    body: string;
    tags?: string[];
};

type TemplateResponse = {
    templates?: MarkdownTemplate[];
};

type NamespaceResponse = {
    response?: {
        msg?: string[];
    };
};

type PageMode = 'read' | 'create' | 'edit';
type EditorMode = 'write' | 'split' | 'preview';

type EditorElements = {
    form: HTMLFormElement;
    title: HTMLInputElement;
    body: HTMLTextAreaElement;
    preview: HTMLElement;
    panes: HTMLElement;
    namespace: HTMLInputElement;
    namespaceOptions: HTMLDataListElement;
    template: HTMLSelectElement;
    url: HTMLInputElement;
    tags: HTMLInputElement;
    tagPreview: HTMLElement;
    source: HTMLInputElement;
    author: HTMLInputElement;
    dataDetails: HTMLDetailsElement;
    data: HTMLTextAreaElement;
    dataError: HTMLElement;
    formError: HTMLElement;
};

const GetEndpoint = '/v1/get';
const NamespacesEndpoint = '/v1/get/namespaces';
const NotesEndpoint = '/v1/notes';
const TemplatesEndpoint = '/v1/admin/templates';
const AdminSessionEndpoint = '/v1/admin/session';
const EditorModeStorageKey = 'cartographer_note_editor_mode';
const ReturnToParameter = 'returnTo';

let activeNote: NoteData | null = null;
let activeNamespace = 'default';
let activeReturnPath: string | null = null;
let pageMode: PageMode = 'read';
let editorDirty = false;
let initialEditorFingerprint = '';
let editorElements: EditorElements | null = null;

// main selects the reader, create, or edit experience from the page URL.
async function main(): Promise<void> {
    const shell = document.getElementById('noteShell');
    if (!shell) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    activeNamespace = NormalizeNamespaceInput(params.get('namespace') || 'default') || 'default';
    activeReturnPath = ResolveReturnPath(params.get(ReturnToParameter), window.location.origin);
    const requestedMode = params.get('mode');
    pageMode = requestedMode === 'create' ? 'create' : requestedMode === 'edit' ? 'edit' : 'read';
    wireGlobalNavigation();

    if (pageMode === 'create') {
        if (!await requireAdmin(shell)) {
            return;
        }
        activeNote = null;
        renderEditor(shell, null, activeNamespace);
        return;
    }

    const id = params.get('id') || '';
    if (!id) {
        renderError(shell, 'Missing note id.');
        return;
    }

    try {
        activeNote = await loadNote(id, activeNamespace);
        if (!activeNote) {
            renderError(shell, 'Note not found.');
            return;
        }
        updateBackLinkDestination();

        if (pageMode === 'edit') {
            if (!await requireAdmin(shell)) {
                return;
            }
            renderEditor(shell, activeNote, activeNamespace);
            return;
        }

        renderReader(shell, activeNote, activeNamespace);
        wireRawLink(id, activeNamespace);
        void wireReaderActions(activeNote, activeNamespace);
    } catch (err) {
        console.error(err);
        renderError(shell, 'Unable to load note.');
    }
}

// loadNote fetches one exact note for the reader or editor.
async function loadNote(id: string, namespace: string): Promise<NoteData | null> {
    const endpoint = new URL(GetEndpoint, window.location.origin);
    endpoint.searchParams.set('id', id);
    endpoint.searchParams.set('namespace', namespace);
    const response = await fetch(endpoint.toString(), {
        headers: {
            'Accept-Encoding': 'gzip',
        },
    });
    if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as CartoResponse;
    return data.response?.notes?.[0] || null;
}

// requireAdmin prevents authoring when the current browser is not authenticated.
async function requireAdmin(shell: HTMLElement): Promise<boolean> {
    const session = await loadAdminSession();
    if (session.admin) {
        return true;
    }

    const message = session.configured
        ? 'Admin access is required to author notes. Unlock admin tools from the notes page first.'
        : 'Note authoring is unavailable because admin authentication is not configured.';
    renderError(shell, message);
    return false;
}

// renderReader writes the focused standalone note article.
function renderReader(shell: HTMLElement, note: NoteData, namespace: string): void {
    setPageChrome(false, 'Note');
    const title = note.title || note.url || note.id;
    const dataText = FormatData(note.data);
    document.title = title;
    shell.replaceChildren();

    const kicker = document.createElement('div');
    kicker.className = 'note-kicker';
    [namespace, note.source || '', note.author || '', note.version ? `v${note.version}` : '', formatTimestamp(note.updated_at)]
        .filter((item) => item.trim() !== '')
        .forEach((item) => {
            const span = document.createElement('span');
            span.textContent = item;
            kicker.appendChild(span);
        });
    shell.appendChild(kicker);

    const heading = document.createElement('h1');
    heading.className = 'note-title';
    heading.textContent = title;
    shell.appendChild(heading);

    if (note.url) {
        const link = document.createElement('a');
        link.className = 'note-link';
        link.href = note.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.innerHTML = '<i class="bi bi-box-arrow-up-right"></i>';
        link.appendChild(document.createTextNode(note.url));
        shell.appendChild(link);
    }

    if (Array.isArray(note.tags) && note.tags.length > 0) {
        const tags = document.createElement('div');
        tags.className = 'note-tags';
        note.tags.forEach((tag) => {
            const chip = document.createElement('span');
            chip.className = 'note-tag';
            chip.textContent = tag;
            tags.appendChild(chip);
        });
        shell.appendChild(tags);
    }

    const markdown = document.createElement('div');
    markdown.className = 'note-markdown';
    markdown.innerHTML = RenderMarkdown(note.body || note.url || '');
    shell.appendChild(markdown);

    if (dataText) {
        shell.appendChild(createDataSection(dataText));
    }
}

// wireReaderActions connects edit and delete controls for authenticated admins.
async function wireReaderActions(note: NoteData, namespace: string): Promise<void> {
    const session = await loadAdminSession();
    if (!session.admin) {
        return;
    }

    const editButton = document.getElementById('editNote') as HTMLButtonElement | null;
    const deleteButton = document.getElementById('deleteNote') as HTMLButtonElement | null;
    editButton?.classList.remove('is-hidden');
    deleteButton?.classList.remove('is-hidden');

    if (editButton) {
        editButton.onclick = () => {
            window.location.assign(getEditorURL(note.id, namespace));
        };
    }

    if (!deleteButton) {
        return;
    }
    deleteButton.onclick = async () => {
        if (!window.confirm(`Delete note "${note.title || note.id}"?`)) {
            return;
        }

        try {
            const endpoint = new URL(NotesEndpoint, window.location.origin);
            endpoint.searchParams.set('id', note.id);
            endpoint.searchParams.set('namespace', namespace);
            const response = await fetch(endpoint.toString(), { method: 'DELETE' });
            if (!response.ok) {
                throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
            }
            invalidateAppCache();
            window.location.assign(getNamespaceURL(namespace));
        } catch (err) {
            console.error(err);
            window.alert('Unable to delete note.');
        }
    };
}

// renderEditor builds the full-page writing canvas and metadata inspector.
function renderEditor(shell: HTMLElement, note: NoteData | null, namespace: string): void {
    const context = note ? 'Edit note' : 'New note';
    setPageChrome(true, context);
    document.title = `${context}${note?.title ? ` · ${note.title}` : ''}`;
    shell.innerHTML = `
        <form id="noteEditorForm" class="note-editor" novalidate>
            <section class="note-editor__main">
                <div class="note-editor__title-wrap">
                    <label class="visually-hidden" for="editorTitle">Title</label>
                    <input id="editorTitle" class="note-editor__title" type="text" autocomplete="off" placeholder="Untitled note" required>
                </div>
                <div class="note-editor__body-header">
                    <span class="note-field-label">Markdown</span>
                    <span class="note-editor__shortcut">Save with ⌘/Ctrl + S</span>
                </div>
                <div id="editorPanes" class="note-editor__panes" data-mode="write">
                    <textarea id="editorBody" class="note-editor__textarea" aria-label="Markdown body" autocomplete="off" spellcheck="true" placeholder="Start writing…" required></textarea>
                    <div id="editorPreview" class="note-editor__preview note-markdown" aria-live="polite"></div>
                </div>
            </section>
            <aside class="note-editor__inspector" aria-label="Note details">
                <h2 class="note-inspector__title">Note details</h2>
                <label class="note-field" for="editorNamespace">
                    <span class="note-field-label">Namespace</span>
                    <input id="editorNamespace" class="form-control" type="text" autocomplete="off" list="editorNamespaceOptions" required>
                </label>
                <datalist id="editorNamespaceOptions"></datalist>
                <label class="note-field" for="editorTemplate">
                    <span class="note-field-label">Template</span>
                    <select id="editorTemplate" class="form-select">
                        <option value="">Choose a template…</option>
                    </select>
                </label>
                <label class="note-field" for="editorURL">
                    <span class="note-field-label">URL</span>
                    <input id="editorURL" class="form-control" type="url" autocomplete="off" placeholder="https://example.com">
                </label>
                <label class="note-field" for="editorTags">
                    <span class="note-field-label">Tags</span>
                    <input id="editorTags" class="form-control" type="text" autocomplete="off" placeholder="ops, runbook, incident">
                </label>
                <div id="editorTagPreview" class="note-tag-preview" aria-live="polite"></div>
                <label class="note-field" for="editorSource">
                    <span class="note-field-label">Source</span>
                    <input id="editorSource" class="form-control" type="text" autocomplete="off" placeholder="cartographer">
                </label>
                <label class="note-field" for="editorAuthor">
                    <span class="note-field-label">Author</span>
                    <input id="editorAuthor" class="form-control" type="text" autocomplete="off">
                </label>
                <details id="editorDataDetails" class="note-data-details">
                    <summary>Structured data</summary>
                    <textarea id="editorData" class="form-control note-data-textarea" aria-label="Structured data JSON" autocomplete="off" spellcheck="false" placeholder='{"key": "value"}'></textarea>
                    <span id="editorDataError" class="note-field-error" aria-live="polite"></span>
                </details>
                <div id="editorFormError" class="note-field-error" aria-live="polite"></div>
            </aside>
        </form>`;

    editorElements = getEditorElements();
    if (!editorElements) {
        renderError(shell, 'Unable to initialize the note editor.');
        return;
    }

    fillEditor(editorElements, note, namespace);
    wireEditor(editorElements);
    void populateNamespaces(editorElements.namespaceOptions);
    void populateTemplates(editorElements.template);
    setEditorMode(getInitialEditorMode());
    updateEditorPreview();
    syncTagPreview();
    initialEditorFingerprint = getEditorFingerprint(editorElements);
    setEditorDirty(false);

    const params = new URLSearchParams(window.location.search);
    if (params.get('focus') === 'namespace') {
        editorElements.namespace.focus();
    } else {
        editorElements.title.focus();
    }
}

// getEditorElements resolves the editor DOM after its shell is rendered.
function getEditorElements(): EditorElements | null {
    const form = document.getElementById('noteEditorForm') as HTMLFormElement | null;
    const title = document.getElementById('editorTitle') as HTMLInputElement | null;
    const body = document.getElementById('editorBody') as HTMLTextAreaElement | null;
    const preview = document.getElementById('editorPreview');
    const panes = document.getElementById('editorPanes');
    const namespace = document.getElementById('editorNamespace') as HTMLInputElement | null;
    const namespaceOptions = document.getElementById('editorNamespaceOptions') as HTMLDataListElement | null;
    const template = document.getElementById('editorTemplate') as HTMLSelectElement | null;
    const url = document.getElementById('editorURL') as HTMLInputElement | null;
    const tags = document.getElementById('editorTags') as HTMLInputElement | null;
    const tagPreview = document.getElementById('editorTagPreview');
    const source = document.getElementById('editorSource') as HTMLInputElement | null;
    const author = document.getElementById('editorAuthor') as HTMLInputElement | null;
    const dataDetails = document.getElementById('editorDataDetails') as HTMLDetailsElement | null;
    const data = document.getElementById('editorData') as HTMLTextAreaElement | null;
    const dataError = document.getElementById('editorDataError');
    const formError = document.getElementById('editorFormError');
    if (!form || !title || !body || !preview || !panes || !namespace || !namespaceOptions || !template || !url || !tags || !tagPreview || !source || !author || !dataDetails || !data || !dataError || !formError) {
        return null;
    }
    return { form, title, body, preview, panes, namespace, namespaceOptions, template, url, tags, tagPreview, source, author, dataDetails, data, dataError, formError };
}

// fillEditor writes an existing note or a fresh draft into the editor.
function fillEditor(elements: EditorElements, note: NoteData | null, namespace: string): void {
    elements.title.value = note?.title || '';
    elements.body.value = note?.body || '';
    elements.namespace.value = namespace;
    elements.namespace.disabled = Boolean(note);
    elements.url.value = note?.url || '';
    elements.tags.value = (note?.tags || []).join(', ');
    elements.source.value = note?.source || '';
    elements.author.value = note?.author || '';
    elements.data.value = FormatData(note?.data);
    elements.dataDetails.open = Boolean(elements.data.value);
    const saveLabel = document.getElementById('saveNoteLabel');
    if (saveLabel) {
        saveLabel.textContent = note ? 'Save changes' : 'Save note';
    }
}

// wireEditor connects draft updates, modes, templates, navigation, and submission.
function wireEditor(elements: EditorElements): void {
    // updateDraftState synchronizes preview and dirty state after form edits.
    const updateDraftState = () => {
        updateEditorPreview();
        setEditorDirty(getEditorFingerprint(elements) !== initialEditorFingerprint);
    };
    elements.form.addEventListener('input', updateDraftState);
    elements.tags.addEventListener('input', syncTagPreview);
    elements.data.addEventListener('input', validateDataInput);
    elements.template.addEventListener('change', () => {
        applySelectedTemplate(elements);
    });
    elements.form.addEventListener('submit', (event) => {
        event.preventDefault();
        void saveEditor(elements);
    });

    document.querySelectorAll<HTMLButtonElement>('[data-editor-mode]').forEach((button) => {
        button.onclick = () => setEditorMode(button.dataset.editorMode as EditorMode);
    });

    const cancel = document.getElementById('cancelEdit') as HTMLButtonElement | null;
    if (cancel) {
        cancel.onclick = () => navigateAwayFromEditor();
    }
}

// populateNamespaces loads namespace suggestions for new notes.
async function populateNamespaces(options: HTMLDataListElement): Promise<void> {
    try {
        const response = await fetch(NamespacesEndpoint, { headers: { 'Accept-Encoding': 'gzip' } });
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json() as NamespaceResponse;
        options.replaceChildren();
        (data.response?.msg || []).forEach((namespace) => {
            const option = document.createElement('option');
            option.value = namespace;
            options.appendChild(option);
        });
    } catch (err) {
        console.error(err);
    }
}

// populateTemplates loads reusable markdown templates into the inspector.
async function populateTemplates(select: HTMLSelectElement): Promise<void> {
    try {
        const response = await fetch(TemplatesEndpoint, { headers: { 'Accept-Encoding': 'gzip' } });
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json() as TemplateResponse;
        (data.templates || []).forEach((template) => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            option.dataset.body = template.body;
            option.dataset.tags = JSON.stringify(template.tags || []);
            select.appendChild(option);
        });
    } catch (err) {
        console.error(err);
    }
}

// applySelectedTemplate appends a template body and merges its tags into the draft.
function applySelectedTemplate(elements: EditorElements): void {
    const option = elements.template.selectedOptions[0];
    if (!option?.value) {
        return;
    }
    const templateBody = option.dataset.body || '';
    const currentBody = elements.body.value.trim();
    elements.body.value = currentBody ? `${currentBody}\n\n${templateBody}` : templateBody;
    let templateTags: string[] = [];
    try {
        templateTags = JSON.parse(option.dataset.tags || '[]') as string[];
    } catch {
        templateTags = [];
    }
    elements.tags.value = Array.from(new Set([...ParseCommaList(elements.tags.value), ...templateTags])).join(', ');
    elements.template.value = '';
    updateEditorPreview();
    syncTagPreview();
    setEditorDirty(getEditorFingerprint(elements) !== initialEditorFingerprint);
    setEditorMode('write');
    elements.body.focus();
}

// syncTagPreview redraws removable chips from the comma-separated tag input.
function syncTagPreview(): void {
    if (!editorElements) {
        return;
    }
    const tags = ParseCommaList(editorElements.tags.value);
    editorElements.tagPreview.replaceChildren();
    tags.forEach((tag) => {
        const chip = document.createElement('button');
        chip.className = 'note-tag-chip';
        chip.type = 'button';
        chip.title = `Remove ${tag}`;
        chip.textContent = `${tag} ×`;
        chip.onclick = () => {
            editorElements!.tags.value = ParseCommaList(editorElements!.tags.value).filter((candidate) => candidate !== tag).join(', ');
            syncTagPreview();
            setEditorDirty(getEditorFingerprint(editorElements!) !== initialEditorFingerprint);
        };
        editorElements!.tagPreview.appendChild(chip);
    });
}

// updateEditorPreview renders the current markdown without moving focus.
function updateEditorPreview(): void {
    if (!editorElements) {
        return;
    }
    const markdown = editorElements.body.value;
    editorElements.preview.innerHTML = markdown.trim()
        ? RenderMarkdown(markdown)
        : '<div class="note-empty">Your rendered note will appear here.</div>';
}

// validateDataInput reports structured data syntax without blocking other editing.
function validateDataInput(): boolean {
    if (!editorElements) {
        return true;
    }
    const result = ParseDataValue(editorElements.data.value);
    editorElements.dataError.textContent = result.error;
    return !result.error;
}

// saveEditor validates and persists the current draft while keeping the editor open.
async function saveEditor(elements: EditorElements): Promise<void> {
    const title = elements.title.value.trim();
    const body = elements.body.value;
    const namespace = NormalizeNamespaceInput(elements.namespace.value);
    const dataResult = ParseDataValue(elements.data.value);
    elements.formError.textContent = '';
    elements.dataError.textContent = dataResult.error;

    if (!title || !body.trim()) {
        elements.formError.textContent = 'Title and markdown body are required.';
        (!title ? elements.title : elements.body).focus();
        setSaveStatus('Check required fields', 'error');
        return;
    }
    if (!IsValidNamespace(namespace)) {
        elements.formError.textContent = 'Use a valid namespace: lowercase letters, numbers, and hyphens.';
        elements.namespace.focus();
        setSaveStatus('Check namespace', 'error');
        return;
    }
    if (dataResult.error) {
        elements.dataDetails.open = true;
        elements.data.focus();
        setSaveStatus('Check structured data', 'error');
        return;
    }

    const id = activeNote?.id || crypto.randomUUID();
    const payload = {
        id,
        title,
        body,
        url: elements.url.value.trim(),
        tags: ParseCommaList(elements.tags.value),
        data: dataResult.value || undefined,
        namespace,
        created_at: NormalizeTimestamp(activeNote?.created_at) || undefined,
        updated_at: undefined,
        source: elements.source.value.trim() || undefined,
        author: elements.author.value.trim() || undefined,
        version: undefined,
    };

    setSaveStatus(activeNote ? 'Saving changes…' : 'Saving note…', 'saving');
    const saveButton = document.getElementById('saveNote') as HTMLButtonElement | null;
    if (saveButton) {
        saveButton.disabled = true;
    }
    try {
        const response = await fetch(NotesEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`Save failed: ${response.status} ${response.statusText}`);
        }

        activeNamespace = namespace;
        activeNote = {
            id,
            title,
            body,
            url: payload.url,
            tags: payload.tags,
            data: dataResult.value || undefined,
            created_at: activeNote?.created_at,
            source: payload.source,
            author: payload.author,
        };
        pageMode = 'edit';
        elements.namespace.value = namespace;
        elements.namespace.disabled = true;
        const saveLabel = document.getElementById('saveNoteLabel');
        if (saveLabel) {
            saveLabel.textContent = 'Save changes';
        }
        const context = document.getElementById('pageContext');
        if (context) {
            context.textContent = 'Edit note';
        }
        document.title = `Edit note · ${title}`;
        window.history.replaceState({}, '', getEditorURL(id, namespace, activeReturnPath));
        updateBackLinkDestination();
        invalidateAppCache();
        initialEditorFingerprint = getEditorFingerprint(elements);
        setEditorDirty(false);
        setSaveStatus('Saved just now', 'success');
    } catch (err) {
        console.error(err);
        elements.formError.textContent = 'Unable to save note. Your draft remains in the editor.';
        setSaveStatus('Save failed', 'error');
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
        }
    }
}

// getEditorFingerprint captures normalized draft values for dirty-state comparison.
function getEditorFingerprint(elements: EditorElements): string {
    const parsedData = ParseDataValue(elements.data.value);
    if (parsedData.error) {
        return JSON.stringify({ invalidData: elements.data.value, draft: getRawEditorDraft(elements) });
    }
    const raw = getRawEditorDraft(elements);
    const draft: NoteDraft = {
        id: activeNote?.id || '',
        title: raw.title,
        url: raw.url,
        body: raw.body,
        tags: ParseCommaList(raw.tags),
        data: parsedData.value,
        namespace: raw.namespace,
        source: raw.source,
        author: raw.author,
        createdAt: NormalizeTimestamp(activeNote?.created_at),
    };
    return DraftFingerprint(draft);
}

// getRawEditorDraft captures form text before semantic normalization.
function getRawEditorDraft(elements: EditorElements): Record<string, string> {
    return {
        title: elements.title.value,
        url: elements.url.value,
        body: elements.body.value,
        tags: elements.tags.value,
        data: elements.data.value,
        namespace: elements.namespace.value,
        source: elements.source.value,
        author: elements.author.value,
    };
}

// setEditorDirty updates navigation protection and visible save state.
function setEditorDirty(dirty: boolean): void {
    editorDirty = dirty;
    if (dirty) {
        setSaveStatus('Unsaved changes', 'dirty');
    } else if (pageMode === 'create') {
        setSaveStatus('New draft', 'clean');
    } else {
        setSaveStatus('All changes saved', 'clean');
    }
}

// setSaveStatus presents current persistence state in the sticky toolbar.
function setSaveStatus(message: string, state: 'clean' | 'dirty' | 'saving' | 'success' | 'error'): void {
    const status = document.getElementById('saveStatus');
    if (!status) {
        return;
    }
    status.textContent = message;
    status.className = 'note-save-status';
    if (state === 'dirty') {
        status.classList.add('note-save-status--dirty');
    } else if (state === 'success') {
        status.classList.add('note-save-status--success');
    } else if (state === 'error') {
        status.classList.add('note-save-status--error');
    }
}

// getInitialEditorMode returns the last supported authoring layout.
function getInitialEditorMode(): EditorMode {
    const savedMode = localStorage.getItem(EditorModeStorageKey);
    if (savedMode === 'preview' || savedMode === 'split') {
        return savedMode;
    }
    return 'write';
}

// setEditorMode switches between writing, split, and rendered preview layouts.
function setEditorMode(mode: EditorMode): void {
    if (!editorElements) {
        return;
    }
    const resolvedMode = mode === 'split' && window.matchMedia('(max-width: 1100px)').matches ? 'write' : mode;
    editorElements.panes.dataset.mode = resolvedMode;
    document.querySelectorAll<HTMLButtonElement>('[data-editor-mode]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.editorMode === resolvedMode));
    });
    localStorage.setItem(EditorModeStorageKey, resolvedMode);
    if (resolvedMode !== 'write') {
        updateEditorPreview();
    }
}

// navigateAwayFromEditor confirms before abandoning an unsaved draft.
function navigateAwayFromEditor(): void {
    if (editorDirty && !window.confirm('Discard your unsaved changes?')) {
        return;
    }
    editorDirty = false;
    window.location.assign(getEditorExitURL());
}

// wireGlobalNavigation configures back navigation, keyboard save, and unload protection.
function wireGlobalNavigation(): void {
    const backLink = document.getElementById('backLink') as HTMLAnchorElement | null;
    if (backLink) {
        updateBackLinkDestination();
        backLink.onclick = (event) => {
            if (pageMode === 'read') {
                return;
            }
            event.preventDefault();
            navigateAwayFromEditor();
        };
    }

    document.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && editorElements) {
            event.preventDefault();
            editorElements.form.requestSubmit();
        }
    });
    window.addEventListener('beforeunload', (event) => {
        if (!editorDirty) {
            return;
        }
        event.preventDefault();
        event.returnValue = '';
    });
}

// updateBackLinkDestination keeps the visible link aligned with editor exit behavior.
function updateBackLinkDestination(): void {
    const backLink = document.getElementById('backLink') as HTMLAnchorElement | null;
    if (!backLink) {
        return;
    }
    backLink.href = pageMode === 'read'
        ? getNamespaceURL(activeNamespace)
        : getEditorExitURL();
}

// getEditorExitURL resolves landing-page context before using reader and namespace fallbacks.
function getEditorExitURL(): string {
    if (activeReturnPath) {
        return new URL(activeReturnPath, window.location.origin).toString();
    }
    if (activeNote) {
        return getReaderURL(activeNote.id, activeNamespace);
    }
    return getNamespaceURL(activeNamespace);
}

// setPageChrome switches shared page framing between reading and authoring.
function setPageChrome(editing: boolean, contextLabel: string): void {
    const page = document.getElementById('notePage');
    const shell = document.getElementById('noteShell');
    const readerActions = document.getElementById('readerActions');
    const editorActions = document.getElementById('editorActions');
    const context = document.getElementById('pageContext');
    page?.classList.toggle('note-page--editor', editing);
    shell?.classList.toggle('note-shell--editor', editing);
    readerActions?.classList.toggle('is-hidden', editing);
    editorActions?.classList.toggle('is-hidden', !editing);
    if (context) {
        context.textContent = contextLabel;
    }
}

// createDataSection builds the standalone structured data display.
function createDataSection(dataText: string): HTMLElement {
    const section = document.createElement('section');
    section.className = 'note-data-section';

    const header = document.createElement('div');
    header.className = 'note-data-header';
    const title = document.createElement('h2');
    title.className = 'note-data-title';
    title.textContent = 'Data';
    header.appendChild(title);

    const copyButton = document.createElement('button');
    copyButton.className = 'note-action';
    copyButton.type = 'button';
    copyButton.innerHTML = '<i class="bi bi-clipboard"></i><span>copy</span>';
    copyButton.onclick = () => {
        copyTextToClipboard(dataText, () => {
            copyButton.innerHTML = '<i class="bi bi-check2"></i><span>copied</span>';
            window.setTimeout(() => {
                copyButton.innerHTML = '<i class="bi bi-clipboard"></i><span>copy</span>';
            }, 1600);
        });
    };
    header.appendChild(copyButton);
    section.appendChild(header);

    const pre = document.createElement('pre');
    pre.className = 'note-data-content';
    pre.textContent = dataText;
    section.appendChild(pre);
    return section;
}

// copyTextToClipboard writes text through the Clipboard API with a textarea fallback.
function copyTextToClipboard(value: string, onSuccess: () => void): void {
    // fallbackCopy supports browsers where the Clipboard API is unavailable.
    const fallbackCopy = () => {
        const textArea = document.createElement('textarea');
        textArea.value = value;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        onSuccess();
    };
    if (!navigator.clipboard?.writeText) {
        fallbackCopy();
        return;
    }
    navigator.clipboard.writeText(value).then(onSuccess).catch((err) => {
        console.error('Failed to copy: ', err);
        fallbackCopy();
    });
}

// loadAdminSession returns whether the current browser is admin-authenticated.
async function loadAdminSession(): Promise<AdminSessionResponse> {
    try {
        const response = await fetch(AdminSessionEndpoint, { headers: { 'Accept-Encoding': 'gzip' } });
        if (!response.ok) {
            throw new Error(`Session check failed: ${response.status} ${response.statusText}`);
        }
        return await response.json() as AdminSessionResponse;
    } catch (err) {
        console.error(err);
        return { admin: false, configured: false };
    }
}

// renderError writes a quiet standalone page error.
function renderError(shell: HTMLElement, message: string): void {
    setPageChrome(false, 'Note');
    shell.replaceChildren();
    const error = document.createElement('div');
    error.className = 'note-empty';
    error.textContent = message;
    shell.appendChild(error);
}

// wireRawLink points the page chrome at the exact raw note query.
function wireRawLink(id: string, namespace: string): void {
    const rawLink = document.getElementById('rawLink') as HTMLAnchorElement | null;
    if (!rawLink) {
        return;
    }
    const rawURL = new URL(GetEndpoint, window.location.origin);
    rawURL.searchParams.set('id', id);
    rawURL.searchParams.set('namespace', namespace);
    rawLink.href = rawURL.toString();
    rawLink.classList.remove('is-hidden');
}

// getNamespaceURL builds the main app URL for a namespace.
function getNamespaceURL(namespace: string): string {
    const url = new URL('/', window.location.origin);
    if (namespace !== 'default') {
        url.searchParams.set('namespace', namespace);
    }
    return url.toString();
}

// getReaderURL builds the focused reader URL for a note.
function getReaderURL(id: string, namespace: string): string {
    const url = new URL('/note', window.location.origin);
    url.searchParams.set('id', id);
    url.searchParams.set('namespace', namespace);
    return url.toString();
}

// getEditorURL builds the full-page editor URL and preserves an optional return path.
function getEditorURL(id: string, namespace: string, returnPath?: string | null): string {
    const url = new URL(getReaderURL(id, namespace));
    url.searchParams.set('mode', 'edit');
    if (returnPath) {
        url.searchParams.set(ReturnToParameter, returnPath);
    }
    return url.toString();
}

// invalidateAppCache clears main-app query results after standalone mutations.
function invalidateAppCache(): void {
    localStorage.removeItem('cartographer_cache');
}

// formatTimestamp renders best-effort note timestamps.
function formatTimestamp(value?: NoteData['updated_at']): string {
    return NormalizeTimestamp(value);
}

window.onload = () => {
    void main();
};
