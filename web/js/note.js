import { RenderMarkdown } from './cards/notes.js';
const GetEndpoint = '/v1/get';
const NotesEndpoint = '/v1/notes';
const AdminSessionEndpoint = '/v1/admin/session';
async function main() {
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
        const data = await response.json();
        const note = data.response?.notes?.[0];
        if (!note) {
            renderError(shell, 'Note not found.');
            return;
        }
        renderNote(shell, note, namespace);
        wireRawLink(id, namespace);
        wireNoteActions(shell, note, namespace);
    }
    catch (err) {
        console.error(err);
        renderError(shell, 'Unable to load note.');
    }
}
function renderNote(shell, note, namespace) {
    const title = note.title || note.url || note.id;
    const dataText = formatData(note.data);
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
async function wireNoteActions(shell, note, namespace) {
    const editButton = document.getElementById('editNote');
    const deleteButton = document.getElementById('deleteNote');
    const session = await loadAdminSession();
    if (!session.admin) {
        return;
    }
    if (editButton) {
        editButton.classList.remove('is-hidden');
        editButton.onclick = () => {
            renderEditForm(shell, note, namespace);
        };
    }
    if (!deleteButton) {
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
        }
        catch (err) {
            console.error(err);
            window.alert('Unable to delete note.');
        }
    };
}
function renderEditForm(shell, note, namespace) {
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
    const existingData = formatData(note.data);
    const dataInput = document.createElement('textarea');
    dataInput.className = 'form-control note-data-textarea';
    dataInput.value = existingData;
    dataInput.spellcheck = false;
    const bodyWrap = document.createElement('label');
    bodyWrap.className = 'form-label';
    bodyWrap.textContent = 'Markdown';
    bodyWrap.appendChild(bodyInput);
    const dataWrap = document.createElement('label');
    dataWrap.className = 'form-label';
    dataWrap.textContent = 'Structured data';
    dataWrap.appendChild(dataInput);
    const addData = document.createElement('button');
    addData.className = 'btn btn-outline-secondary btn-sm note-data-add d-inline-flex align-items-center gap-2';
    addData.type = 'button';
    addData.innerHTML = '<i class="bi bi-plus-lg"></i> Structured data';
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
    const setDataEditorVisible = (visible) => {
        addData.classList.toggle('is-hidden', visible);
        dataWrap.classList.toggle('is-hidden', !visible);
        addData.setAttribute('aria-expanded', String(visible));
    };
    addData.onclick = () => {
        setDataEditorVisible(true);
        dataInput.focus();
    };
    setDataEditorVisible(Boolean(existingData));
    form.appendChild(titleInput.label);
    form.appendChild(urlInput.label);
    form.appendChild(tagsInput.label);
    form.appendChild(bodyWrap);
    form.appendChild(addData);
    form.appendChild(dataWrap);
    form.appendChild(actions);
    form.onsubmit = async (event) => {
        event.preventDefault();
        const title = titleInput.input.value.trim();
        const body = bodyInput.value.trim();
        if (!title || !body) {
            status.textContent = 'Title and markdown body are required.';
            return;
        }
        const structuredData = parseDataValue(dataInput.value, status);
        if (structuredData === false) {
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
                    data: structuredData || undefined,
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
        }
        catch (err) {
            console.error(err);
            status.textContent = 'Unable to save note.';
        }
    };
    shell.appendChild(form);
    titleInput.input.focus();
}
function createInput(labelText, value) {
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
function createDataSection(dataText) {
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
function copyTextToClipboard(text, onSuccess) {
    const fallbackCopy = () => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
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
    navigator.clipboard.writeText(text).then(onSuccess).catch(err => {
        console.error('Failed to copy: ', err);
        fallbackCopy();
    });
}
async function loadAdminSession() {
    try {
        const response = await fetch(AdminSessionEndpoint, {
            headers: {
                'Accept-Encoding': 'gzip',
            },
        });
        if (!response.ok) {
            throw new Error(`Session check failed: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }
    catch (err) {
        console.error(err);
        return { admin: false, configured: false };
    }
}
function renderError(shell, message) {
    shell.replaceChildren();
    const error = document.createElement('div');
    error.className = 'note-empty';
    error.textContent = message;
    shell.appendChild(error);
}
function wireRawLink(id, namespace) {
    const rawLink = document.getElementById('rawLink');
    if (!rawLink) {
        return;
    }
    const rawURL = new URL(GetEndpoint, window.location.origin);
    rawURL.searchParams.set('id', id);
    rawURL.searchParams.set('namespace', namespace);
    rawLink.href = rawURL.toString();
    rawLink.classList.remove('is-hidden');
}
function parseCommaList(value) {
    return value.split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
}
function parseDataValue(value, status) {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
            throw new Error('Data must be a JSON object.');
        }
        return parsed;
    }
    catch (err) {
        console.error(err);
        status.textContent = 'Data must be valid JSON object syntax.';
        return false;
    }
}
function formatData(data) {
    if (!data || Object.keys(data).length === 0) {
        return '';
    }
    return JSON.stringify(data, null, 2);
}
function getNamespaceURL(namespace) {
    const url = new URL('/', window.location.origin);
    if (namespace !== 'default') {
        url.searchParams.set('namespace', namespace);
    }
    return url.toString();
}
function invalidateAppCache() {
    localStorage.removeItem('cartographer_cache');
}
function formatTimestamp(value) {
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
