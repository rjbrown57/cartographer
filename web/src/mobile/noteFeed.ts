import { RenderMarkdown } from '../shared/markdown.js';
import type { NoteData } from '../shared/types.js';
import { FormatMobileTimestamp, GetMobileNoteType } from './model.js';

type TagSelectHandler = (tag: string) => void;

// MobileNoteFeed owns rendering and navigation for the phone-only note list.
export class MobileNoteFeed {
    private readonly container: HTMLElement;
    private readonly onTagSelect: TagSelectHandler;

    // constructor binds the mobile feed to its container and tag callback.
    constructor(container: HTMLElement, onTagSelect: TagSelectHandler) {
        this.container = container;
        this.onTagSelect = onTagSelect;
    }

    // Render replaces the current feed with mobile-specific note items.
    Render(notes: NoteData[], namespace: string): void {
        this.container.replaceChildren();
        if (notes.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'mobile-empty';
            empty.innerHTML = '<i class="bi bi-journal-x"></i><strong>No notes found</strong><span>Try another search, tag, or namespace.</span>';
            this.container.appendChild(empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        notes.forEach((note) => fragment.appendChild(this.CreateNote(note, namespace)));
        this.container.appendChild(fragment);
    }

    // CreateNote builds one feed item without depending on desktop card code.
    private CreateNote(note: NoteData, namespace: string): HTMLElement {
        const noteType = GetMobileNoteType(note);
        const article = document.createElement('article');
        article.className = `mobile-note ${noteType.className}`;
        article.tabIndex = 0;
        article.setAttribute('role', 'link');
        article.setAttribute('aria-label', `Open ${note.title || 'note'}`);

        const destination = this.GetNoteURL(note, namespace);
        article.addEventListener('click', (event) => {
            if ((event.target as HTMLElement | null)?.closest('a, button')) {
                return;
            }
            window.location.assign(destination);
        });
        article.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                window.location.assign(destination);
            }
        });

        const meta = document.createElement('div');
        meta.className = 'mobile-note__meta';
        meta.innerHTML = `<span class="mobile-note__type"><i class="${noteType.icon}"></i>${noteType.label}</span>`;
        const timestamp = FormatMobileTimestamp(note.updated_at || note.created_at);
        if (timestamp) {
            const time = document.createElement('span');
            time.className = 'mobile-note__date';
            time.textContent = timestamp;
            meta.appendChild(time);
        }
        if (note.source) {
            const source = document.createElement('span');
            source.className = 'mobile-note__source';
            source.textContent = note.source;
            meta.appendChild(source);
        }

        const title = document.createElement('h2');
        title.className = 'mobile-note__title';
        title.textContent = note.title || note.url || note.id;

        const preview = document.createElement('div');
        preview.className = 'mobile-note__preview';
        preview.innerHTML = RenderMarkdown(note.body || note.url || '');

        const footer = document.createElement('div');
        footer.className = 'mobile-note__footer';
        const tags = document.createElement('div');
        tags.className = 'mobile-note__tags';
        (note.tags || []).slice(0, 3).forEach((tag) => tags.appendChild(this.CreateTag(tag)));
        if ((note.tags || []).length > 3) {
            const overflow = document.createElement('span');
            overflow.className = 'mobile-note__more';
            overflow.textContent = `+${note.tags.length - 3}`;
            tags.appendChild(overflow);
        }

        const open = document.createElement('span');
        open.className = 'mobile-note__open';
        open.setAttribute('aria-hidden', 'true');
        open.innerHTML = '<i class="bi bi-chevron-right"></i>';
        footer.append(tags, open);
        article.append(meta, title, preview, footer);
        return article;
    }

    // CreateTag builds an inline tag control for the mobile feed.
    private CreateTag(tag: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mobile-note__tag';
        button.textContent = tag;
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            this.onTagSelect(tag);
        });
        return button;
    }

    // GetNoteURL preserves the mobile page as the editor and reader return destination.
    private GetNoteURL(note: NoteData, namespace: string): string {
        const url = new URL('/note', window.location.origin);
        url.searchParams.set('id', note.id || note.url || note.title);
        url.searchParams.set('namespace', namespace);
        url.searchParams.set('returnTo', `${window.location.pathname}${window.location.search}${window.location.hash}`);
        return url.toString();
    }
}
