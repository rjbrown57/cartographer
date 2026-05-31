import { RenderMarkdown } from './cards/notes.js';
const GetEndpoint = '/v1/get';
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
    }
    catch (err) {
        console.error(err);
        renderError(shell, 'Unable to load note.');
    }
}
function renderNote(shell, note, namespace) {
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
