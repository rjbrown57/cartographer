import { RenderMarkdown } from './cards/notes.js';

type NoteData = {
    id: string;
    title: string;
    url: string;
    body: string;
    tags: string[];
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
