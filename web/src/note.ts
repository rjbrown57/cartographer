import { RenderMarkdown } from './cards/notes.js';

type NoteData = {
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

type TimestampValue = string | {
    seconds?: number | string;
    nanos?: number;
};

type CartoResponse = {
    response?: {
        notes?: NoteData[];
    };
};

const GetEndpoint = '/v1/get';
const NotesEndpoint = '/v1/notes';
const AdminSessionEndpoint = '/v1/admin/session';

type AdminSessionResponse = {
    admin: boolean;
    configured: boolean;
};

// main loads and renders one exact note for sharing.
async function main(): Promise<void> {
    const shell = document.getElementById('noteShell');
    if (!shell) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || '';
    const namespace = params.get('namespace') || 'default';

    if (!id) {
        renderError(shell, 'Missing note id.');
        return;
    }

    try {
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
        const note = data.response?.notes?.[0];
        if (!note) {
            renderError(shell, 'Note not found.');
            return;
        }

        renderNote(shell, note, namespace);
        wireRawLink(id, namespace);
        wireNoteActions(shell, note, namespace);
    } catch (err) {
        console.error(err);
        renderError(shell, 'Unable to load note.');
    }
}

// renderNote writes the standalone note article.
function renderNote(shell: HTMLElement, note: NoteData, namespace: string): void {
    const title = note.title || note.url || note.id;
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
}

// wireNoteActions connects edit and admin delete controls for the standalone page.
async function wireNoteActions(shell: HTMLElement, note: NoteData, namespace: string): Promise<void> {
    const editButton = document.getElementById('editNote') as HTMLButtonElement | null;
    const deleteButton = document.getElementById('deleteNote') as HTMLButtonElement | null;

    if (editButton) {
        editButton.classList.remove('is-hidden');
        editButton.onclick = () => {
            renderEditForm(shell, note, namespace);
        };
    }

    const session = await loadAdminSession();
    if (!session.admin || !deleteButton) {
        return;
    }

    deleteButton.classList.remove('is-hidden');
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

// renderEditForm replaces the article view with a compact note edit form.
function renderEditForm(shell: HTMLElement, note: NoteData, namespace: string): void {
    shell.replaceChildren();

    const form = document.createElement('form');
    form.className = 'note-edit-form';

    const titleInput = createInput('Title', note.title || '');
    const urlInput = createInput('URL', note.url || '');
    const tagsInput = createInput('Tags', (note.tags || []).join(', '));
    const bodyInput = document.createElement('textarea');
    bodyInput.className = 'form-control';
    bodyInput.value = note.body || '';
    bodyInput.required = true;

    const bodyWrap = document.createElement('label');
    bodyWrap.className = 'form-label';
    bodyWrap.textContent = 'Markdown';
    bodyWrap.appendChild(bodyInput);

    const status = document.createElement('span');
    status.className = 'note-form-status';

    const actions = document.createElement('div');
    actions.className = 'd-flex align-items-center gap-2 flex-wrap';

    const save = document.createElement('button');
    save.className = 'btn btn-primary d-inline-flex align-items-center gap-2';
    save.type = 'submit';
    save.innerHTML = '<i class="bi bi-save"></i> Save changes';

    const cancel = document.createElement('button');
    cancel.className = 'btn btn-outline-secondary';
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.onclick = () => {
        renderNote(shell, note, namespace);
        void wireNoteActions(shell, note, namespace);
    };

    actions.appendChild(save);
    actions.appendChild(cancel);
    actions.appendChild(status);

    form.appendChild(titleInput.label);
    form.appendChild(urlInput.label);
    form.appendChild(tagsInput.label);
    form.appendChild(bodyWrap);
    form.appendChild(actions);

    form.onsubmit = async (event) => {
        event.preventDefault();

        const title = titleInput.input.value.trim();
        const body = bodyInput.value.trim();
        if (!title || !body) {
            status.textContent = 'Title and markdown body are required.';
            return;
        }

        status.textContent = 'Saving changes...';
        try {
            const response = await fetch(NotesEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: note.id,
                    title,
                    body,
                    url: urlInput.input.value.trim(),
                    tags: parseCommaList(tagsInput.input.value),
                    data: note.data || undefined,
                    namespace,
                    source: note.source || undefined,
                    author: note.author || undefined,
                }),
            });
            if (!response.ok) {
                throw new Error(`Save failed: ${response.status} ${response.statusText}`);
            }

            invalidateAppCache();
            window.location.reload();
        } catch (err) {
            console.error(err);
            status.textContent = 'Unable to save note.';
        }
    };

    shell.appendChild(form);
    titleInput.input.focus();
}

// createInput builds a labeled text input for the edit form.
function createInput(labelText: string, value: string): { label: HTMLLabelElement; input: HTMLInputElement } {
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = labelText;

    const input = document.createElement('input');
    input.className = 'form-control';
    input.type = 'text';
    input.value = value;
    if (labelText === 'Title') {
        input.required = true;
    }

    label.appendChild(input);
    return { label, input };
}

// loadAdminSession returns whether the current browser is admin-authenticated.
async function loadAdminSession(): Promise<AdminSessionResponse> {
    try {
        const response = await fetch(AdminSessionEndpoint, {
            headers: {
                'Accept-Encoding': 'gzip',
            },
        });
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

// parseCommaList returns trimmed comma-separated form values.
function parseCommaList(value: string): string[] {
    return value.split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
}

// getNamespaceURL builds the main app URL for a namespace.
function getNamespaceURL(namespace: string): string {
    const url = new URL('/', window.location.origin);
    if (namespace !== 'default') {
        url.searchParams.set('namespace', namespace);
    }
    return url.toString();
}

// invalidateAppCache clears the main app data cache after standalone mutations.
function invalidateAppCache(): void {
    localStorage.removeItem('cartographer_cache');
}

// formatTimestamp renders best-effort note timestamps.
function formatTimestamp(value?: TimestampValue): string {
    if (!value) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }

    const seconds = Number(value.seconds || 0);
    if (!seconds) {
        return '';
    }
    return new Date(seconds * 1000).toISOString();
}

window.onload = () => {
    void main();
};
