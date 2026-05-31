import * as cards from "./cards";
import { TagFilter } from "../components/searchBar.js";
import * as query from "../query/query.js";

declare const marked: {
    parse(markdown: string): string | Promise<string>;
};

declare const DOMPurify: {
    sanitize(html: string): string;
};

type CardOverlay = HTMLElement & {
    activeCard?: Note;
    keyHandler?: (event: KeyboardEvent) => void;
};

type NoteEditDetail = {
    id: string;
    title: string;
    body: string;
    url: string;
    tags: string[];
    data?: Record<string, any>;
    metadata?: NoteMetadata;
};

type NoteDeleteDetail = {
    id: string;
    title: string;
};

type NoteTypeDetail = {
    className: string;
    icon: string;
    label: string;
};

export type NoteMetadata = {
    created_at?: TimestampValue;
    updated_at?: TimestampValue;
    source?: string;
    author?: string;
    version?: number;
};

export type TimestampValue = string | {
    seconds?: number | string;
    nanos?: number;
};

// RenderMarkdown renders markdown text through the configured sanitizer.
export function RenderMarkdown(markdown: string): string {
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
        return EscapeHTML(markdown).replace(/\n/g, '<br>');
    }

    const rendered = marked.parse(markdown || '');
    if (typeof rendered !== 'string') {
        return EscapeHTML(markdown).replace(/\n/g, '<br>');
    }

    return DOMPurify.sanitize(rendered);
}

// EscapeHTML escapes plain text when markdown dependencies are unavailable.
function EscapeHTML(value: string): string {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}

// Note implements Card for all Cartographer data, including URL-bearing notes.
export class Note implements cards.Card {
    id: string;
    displayname: string;
    title: string;
    body: string;
    url: string;
    tags: string[];
    data?: Record<string, any>;
    metadata: NoteMetadata;
    private self: HTMLElement;
    private isMaximized: boolean = false;
    private originalParent: HTMLElement | null = null;
    private originalNextSibling: Node | null = null;
    private tagList!: HTMLUListElement;
    private tagsExpanded: boolean = false;
    private readonly maxVisibleTags: number = 4;

    // constructor initializes a note card instance and its base DOM element.
    constructor(id: string, title: string, body: string, url: string, tags: string[], data?: Record<string, any>, metadata: NoteMetadata = {}) {
        this.id = id;
        this.title = title;
        this.displayname = title;
        this.body = body;
        this.url = url;
        this.tags = tags;
        this.data = data;
        this.metadata = metadata;
        this.self = document.createElement('div');
    }

    // log writes the current card instance for debugging.
    log(): void {
        console.log(this);
    }

    // render builds and returns the full note card DOM.
    render(): Node {
        const card = this.self;
        this.setupCardBase(card);
        card.replaceChildren();
        const dataText = this.data ? JSON.stringify(this.data, null, 2) : null;
        card.appendChild(this.createNoteActions());
        card.appendChild(this.createCardView(dataText));
        return card;
    }

    // setupCardBase sets base attributes and classes on the card element.
    private setupCardBase(card: HTMLElement): void {
        card.id = this.id || this.title;
        const noteType = this.getNoteType();
        card.className = `link-card note-card ${noteType.className}`;
        card.dataset.noteType = noteType.label;
        card.onclick = (event) => {
            this.handleCardClick(event);
        };
    }

    // handleCardClick expands the card unless an inner control handled the click.
    private handleCardClick(event: MouseEvent): void {
        if (this.isMaximized) {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (target?.closest('a, button, input, textarea, select, label, [role="button"]')) {
            return;
        }

        this.maximize();
    }

    // createCardView creates the card view wrapper including body and footer.
    private createCardView(dataText: string | null): HTMLElement {
        const cardView = document.createElement('div');
        cardView.className = 'card-view';

        const body = this.createBody(dataText);
        const footer = this.createFooter();

        cardView.appendChild(body);
        cardView.appendChild(footer);
        return cardView;
    }

    // createBody builds the title, URL action, markdown body, and data panel.
    private createBody(dataText: string | null): HTMLElement {
        const body = document.createElement('div');
        body.className = 'note-card__content d-flex flex-column gap-2';

        body.appendChild(this.createMetaRow());

        const title = this.createTitleElement('link-title note-title');
        this.setHighlightedText(title, this.title, this.getSearchTerms());
        body.appendChild(title);

        const markdown = document.createElement('div');
        markdown.className = 'link-description note-markdown note-markdown--preview';
        markdown.innerHTML = RenderMarkdown(this.body);
        this.highlightTermsInElement(markdown, this.getSearchTerms());
        body.appendChild(markdown);

        if (dataText) {
            body.appendChild(this.createDataContainer(dataText));
        }

        return body;
    }

    // createMetaRow builds the compact card metadata row.
    private createMetaRow(): HTMLElement {
        const meta = document.createElement('div');
        meta.className = 'note-meta-row';

        const noteType = this.getNoteType();
        const typeBadge = document.createElement('span');
        typeBadge.className = 'note-type-badge';
        typeBadge.innerHTML = `<i class="${noteType.icon}"></i> ${noteType.label}`;
        meta.appendChild(typeBadge);

        if (this.tags.length > 0) {
            const tagCount = document.createElement('span');
            tagCount.className = 'note-meta-chip note-meta-chip--tags';
            tagCount.innerHTML = `<i class="bi bi-tags"></i> ${this.tags.length}`;
            meta.appendChild(tagCount);
        }

        if (this.metadata.version) {
            const versionChip = document.createElement('span');
            versionChip.className = 'note-meta-chip';
            versionChip.innerHTML = `<i class="bi bi-clock-history"></i> v${this.metadata.version}`;
            meta.appendChild(versionChip);
        }

        if (this.metadata.source) {
            const sourceChip = document.createElement('span');
            sourceChip.className = 'note-meta-chip';
            sourceChip.textContent = this.metadata.source;
            meta.appendChild(sourceChip);
        }

        return meta;
    }

    // getNoteType returns the visual source treatment for this note.
    private getNoteType(): NoteTypeDetail {
        if (this.data) {
            return {
                className: 'note-card--data',
                icon: 'bi bi-braces',
                label: 'Data',
            };
        }

        if (this.url) {
            return {
                className: 'note-card--link',
                icon: 'bi bi-link-45deg',
                label: 'Link',
            };
        }

        return {
            className: 'note-card--text',
            icon: 'bi bi-journal-text',
            label: 'Note',
        };
    }

    // createTitleElement builds a URL link when present, otherwise plain title text.
    private createTitleElement(className: string): HTMLElement {
        if (this.url) {
            const link = document.createElement('a');
            link.href = this.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = className;
            link.title = this.url;
            return link;
        }

        const title = document.createElement('span');
        title.className = className;
        return title;
    }

    // createNoteActions builds note-level actions for editing the current note.
    private createNoteActions(): HTMLElement {
        const actions = document.createElement('div');
        actions.className = 'note-actions';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'note-action-button';
        editButton.title = 'Edit note';
        editButton.setAttribute('aria-label', 'Edit note');
        editButton.innerHTML = '<i class="bi bi-pencil-square"></i>';
        editButton.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.dispatchEditEvent();
        };

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'note-action-button';
        copyButton.title = 'Copy note body';
        copyButton.setAttribute('aria-label', 'Copy note body');
        copyButton.innerHTML = '<i class="bi bi-clipboard"></i>';
        copyButton.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.copyTextToClipboard(this.body, () => {
                this.setInlineActionState(copyButton, '<i class="bi bi-check2"></i>');
            });
        };

        actions.appendChild(editButton);
        actions.appendChild(copyButton);
        actions.appendChild(this.createPageButton());
        actions.appendChild(this.createRawButton());
        actions.appendChild(this.createDeleteButton());
        return actions;
    }

    // copyTextToClipboard writes text to the Clipboard API with a textarea fallback.
    private copyTextToClipboard(text: string, onSuccess: () => void): void {
        navigator.clipboard.writeText(text).then(onSuccess).catch(err => {
            console.error('Failed to copy: ', err);
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            onSuccess();
        });
    }

    // setInlineActionState temporarily updates inline note action button content.
    private setInlineActionState(button: HTMLButtonElement, copiedHTML: string): void {
        const originalHTML = button.innerHTML;
        button.innerHTML = copiedHTML;
        button.classList.add('note-action-button--success');

        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('note-action-button--success');
        }, 1600);
    }

    // dispatchEditEvent sends the current note data to the shared composer.
    private dispatchEditEvent(): void {
        document.dispatchEvent(new CustomEvent('cartographer:edit-note', {
            detail: {
                id: this.id,
                title: this.title,
                body: this.body,
                url: this.url,
                tags: this.tags,
                data: this.data,
                metadata: this.metadata,
            },
        } satisfies CustomEventInit<NoteEditDetail>));
    }

    // dispatchDeleteEvent asks the app shell to delete this note.
    private dispatchDeleteEvent(): void {
        document.dispatchEvent(new CustomEvent('cartographer:delete-note', {
            detail: {
                id: this.id,
                title: this.title,
            },
        } satisfies CustomEventInit<NoteDeleteDetail>));
    }

    // createDataContainer creates the data container with copy action.
    private createDataContainer(dataText: string): HTMLElement {
        const dataContainer = document.createElement('div');
        dataContainer.className = 'data-container is-hidden';
        dataContainer.id = `data-${this.id}`;

        const dataLabel = document.createElement('h4');
        dataLabel.className = 'data-label';
        dataLabel.textContent = 'Data:';
        dataContainer.appendChild(dataLabel);

        const dataContent = document.createElement('pre');
        dataContent.className = 'data-content';
        dataContent.textContent = dataText;
        dataContainer.appendChild(dataContent);

        const actionBar = document.createElement('div');
        actionBar.className = 'action-bar';

        const copyButton = this.createCopyButton(dataText);
        actionBar.appendChild(copyButton);
        dataContainer.appendChild(actionBar);

        return dataContainer;
    }

    // createCopyButton builds the copy button for data text.
    private createCopyButton(dataText: string): HTMLButtonElement {
        const copyButton = document.createElement('button');
        copyButton.className = 'btn btn-primary btn-sm d-inline-flex align-items-center gap-2';
        copyButton.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
        copyButton.onclick = () => {
            this.copyTextToClipboard(dataText, () => {
                this.setCopyButtonState(copyButton, true);
            });
        };

        return copyButton;
    }

    // createRawButton builds a button that opens the exact raw note API query.
    private createRawButton(): HTMLButtonElement {
        const rawButton = document.createElement('button');
        rawButton.type = 'button';
        rawButton.className = 'note-action-button';
        rawButton.title = 'Open raw note data';
        rawButton.setAttribute('aria-label', 'Open raw note data');
        rawButton.innerHTML = '<i class="bi bi-code-slash"></i>';
        rawButton.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.open(this.getRawQueryURL(), '_blank', 'noopener,noreferrer');
        };

        return rawButton;
    }

    // createPageButton builds a button that opens this note as a standalone page.
    private createPageButton(): HTMLButtonElement {
        const pageButton = document.createElement('button');
        pageButton.type = 'button';
        pageButton.className = 'note-action-button';
        pageButton.title = 'Open note page';
        pageButton.setAttribute('aria-label', 'Open note page');
        pageButton.innerHTML = '<i class="bi bi-file-earmark-richtext"></i>';
        pageButton.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.open(this.getNotePageURL(), '_blank', 'noopener,noreferrer');
        };

        return pageButton;
    }

    // createDeleteButton builds an admin-only delete action for this note.
    private createDeleteButton(): HTMLButtonElement {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'note-action-button note-action-button--danger admin-only';
        deleteButton.title = 'Delete note';
        deleteButton.setAttribute('aria-label', 'Delete note');
        deleteButton.innerHTML = '<i class="bi bi-trash"></i>';
        deleteButton.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.dispatchDeleteEvent();
        };

        return deleteButton;
    }

    // getRawQueryURL builds the v1/get query URL for this exact card.
    private getRawQueryURL(): string {
        const rawURL = new URL(query.GetEndpoint, window.location.origin);
        rawURL.searchParams.set('id', this.id);
        rawURL.searchParams.set('namespace', query.GetSelectedNamespace());
        return rawURL.toString();
    }

    // getNotePageURL builds the standalone rendered note URL.
    private getNotePageURL(): string {
        const pageURL = new URL('/note', window.location.origin);
        pageURL.searchParams.set('id', this.id);
        pageURL.searchParams.set('namespace', query.GetSelectedNamespace());
        return pageURL.toString();
    }

    // setCopyButtonState updates the copy button to a temporary copied state.
    private setCopyButtonState(copyButton: HTMLButtonElement, copied: boolean): void {
        if (!copied) {
            return;
        }

        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="bi bi-check-circle-fill"></i> Copied!';
        copyButton.className = 'btn btn-success btn-sm d-inline-flex align-items-center gap-2';

        setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyButton.className = 'btn btn-primary btn-sm d-inline-flex align-items-center gap-2';
        }, 2000);
    }

    // createFooter creates the footer section that hosts the tag list.
    private createFooter(): HTMLElement {
        const footer = document.createElement('div');
        footer.className = 'footer';

        this.tagList = document.createElement('ul');
        this.tagList.className = 'tag-list';

        this.renderTags();
        footer.appendChild(this.tagList);

        return footer;
    }

    // renderTags renders the tag list with expand/collapse behavior.
    private renderTags(showAllOverride: boolean = false): void {
        if (!this.tagList) {
            return;
        }

        this.tagList.innerHTML = '';

        const tagIcon = document.createElement('i');
        tagIcon.className = 'bi bi-tags tag-icon';
        this.tagList.appendChild(tagIcon);

        const shouldShowAll = showAllOverride || this.tagsExpanded || this.tags.length <= this.maxVisibleTags;
        const visibleTags = shouldShowAll ? this.tags : this.tags.slice(0, this.maxVisibleTags);

        visibleTags.forEach(tag => {
            const li = document.createElement('li');
            li.className = 'tag-pill';
            if (this.tagMatchesActiveSearch(tag)) {
                li.classList.add('tag-pill--match');
            }

            const tagLink = document.createElement('a');
            tagLink.href = "#";
            tagLink.className = 'tag-link';
            this.setHighlightedText(tagLink, tag, this.getSearchTerms());
            tagLink.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                TagFilter(tag);
            };
            li.appendChild(tagLink);
            this.tagList.appendChild(li);
        });

        if (!shouldShowAll && this.tags.length > this.maxVisibleTags) {
            this.appendTagAction(`+${this.tags.length - this.maxVisibleTags} more`, () => {
                this.tagsExpanded = true;
                this.renderTags(this.isMaximized);
            });
        } else if (!showAllOverride && this.tagsExpanded && this.tags.length > this.maxVisibleTags) {
            this.appendTagAction('Show less', () => {
                this.tagsExpanded = false;
                this.renderTags(false);
            });
        }
    }

    // appendTagAction appends a tag list action button.
    private appendTagAction(label: string, action: () => void): void {
        const li = document.createElement('li');
        li.className = 'tag-pill';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tag-action';
        button.textContent = label;
        button.onclick = (event) => {
            event.preventDefault();
            action();
        };

        li.appendChild(button);
        this.tagList.appendChild(li);
    }

    // toggleMaximize toggles between maximized and minimized states.
    toggleMaximize(): void {
        if (this.isMaximized) {
            this.minimize();
        } else {
            this.maximize();
        }
    }

    // maximize expands the card into a fullscreen overlay.
    maximize(): void {
        const card = this.self;
        const dataContainer = card.querySelector('.data-container') as HTMLElement;
        const markdown = card.querySelector('.note-markdown') as HTMLElement | null;

        this.originalParent = card.parentElement;
        this.originalNextSibling = card.nextSibling;

        let overlay = document.getElementById('maximized-card-overlay') as CardOverlay | null;
        if (!overlay) {
            const createdOverlay = document.createElement('div') as CardOverlay;
            createdOverlay.id = 'maximized-card-overlay';
            createdOverlay.className = 'maximized-overlay';
            document.body.appendChild(createdOverlay);

            createdOverlay.addEventListener('click', (e) => {
                if (e.target === createdOverlay) {
                    createdOverlay.activeCard?.minimize();
                }
            });

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && createdOverlay.style.display !== 'none') {
                    createdOverlay.activeCard?.minimize();
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            createdOverlay.keyHandler = handleKeyDown;
            overlay = createdOverlay;
        }

        card.remove();
        overlay.replaceChildren(card);
        overlay.activeCard = this;
        card.className = `link-card note-card ${this.getNoteType().className}`;

        if (markdown) {
            markdown.classList.remove('note-markdown--preview');
        }
        if (dataContainer) {
            dataContainer.classList.remove('is-hidden');
        }

        overlay.style.display = 'flex';

        this.renderTags(true);
        this.isMaximized = true;
    }

    // minimize restores the card back into the grid.
    minimize(): void {
        const card = this.self;
        const dataContainer = card.querySelector('.data-container') as HTMLElement;
        const markdown = card.querySelector('.note-markdown') as HTMLElement | null;
        const overlay = document.getElementById('maximized-card-overlay') as CardOverlay | null;

        if (overlay) {
            overlay.style.display = 'none';
            if (overlay.activeCard === this) {
                overlay.activeCard = undefined;
            }
        }

        card.className = `link-card note-card ${this.getNoteType().className}`;

        if (markdown) {
            markdown.classList.add('note-markdown--preview');
        }
        if (dataContainer) {
            dataContainer.classList.add('is-hidden');
        }
        this.tagsExpanded = false;
        this.renderTags(false);

        const gridContainer = document.getElementById("linkgrid");
        if (gridContainer && this.originalParent) {
            card.remove();
            if (this.originalNextSibling) {
                gridContainer.insertBefore(card, this.originalNextSibling);
            } else {
                gridContainer.appendChild(card);
            }
        }

        this.isMaximized = false;
    }

    // processFilter applies the text/tag filter to toggle visibility.
    processFilter(filter: string[]): void {
        if (filter.length === 0) {
            this.refreshSearchHighlights();
            this.show();
            return;
        }

        const searchableText = `${this.title} ${this.body} ${this.url}`.toUpperCase();
        const matchesAll = filter.every(term =>
            searchableText.includes(term.toUpperCase()) ||
            this.tags.some(tag => tag.toUpperCase().includes(term.toUpperCase()))
        );

        if (matchesAll) {
            this.refreshSearchHighlights();
            this.show();
        } else {
            this.hide();
        }
    }

    // show shows the card.
    show(): void {
        this.self.style.display = "";
    }

    // hide hides the card.
    hide(): void {
        this.self.style.display = "none";
    }

    // remove removes the card from the DOM.
    remove(): void {
        this.self.remove();
    }

    // refreshSearchHighlights updates visible card matches after live filtering.
    private refreshSearchHighlights(): void {
        const title = this.self.querySelector('.link-title') as HTMLElement | null;
        if (title) {
            this.setHighlightedText(title, this.title, this.getSearchTerms());
        }

        const markdown = this.self.querySelector('.note-markdown') as HTMLElement | null;
        if (markdown) {
            markdown.innerHTML = RenderMarkdown(this.body);
            this.highlightTermsInElement(markdown, this.getSearchTerms());
        }

        this.renderTags(this.isMaximized);
    }

    // getSearchTerms returns active URL and input search terms for highlighting.
    private getSearchTerms(): string[] {
        const urlTerms = new URLSearchParams(window.location.search).getAll('term');
        const searchElement = document.getElementById('searchBar') as HTMLInputElement | null;
        const inputTerms = searchElement?.value.split(/\s+/) || [];
        const terms = [...urlTerms, ...inputTerms]
            .flatMap(term => term.split(/\s+/))
            .map(term => term.trim())
            .filter(term => term.length > 1);

        return Array.from(new Set(terms));
    }

    // getActiveTags returns tag filters currently expressed in the URL.
    private getActiveTags(): Set<string> {
        const tags = new URLSearchParams(window.location.search)
            .getAll('tag')
            .flatMap(tag => tag.split(/\s+/))
            .map(tag => tag.trim().toLowerCase())
            .filter(tag => tag !== '');

        return new Set(tags);
    }

    // tagMatchesActiveSearch checks whether a tag is part of the active search state.
    private tagMatchesActiveSearch(tag: string): boolean {
        const normalizedTag = tag.toLowerCase();
        const activeTags = this.getActiveTags();
        const activeTerms = this.getSearchTerms().map(term => term.toLowerCase());

        return activeTags.has(normalizedTag) || activeTerms.some(term => normalizedTag.includes(term));
    }

    // setHighlightedText writes text content and wraps active search matches.
    private setHighlightedText(element: HTMLElement, value: string, terms: string[]): void {
        element.textContent = value;
        this.highlightTermsInElement(element, terms);
    }

    // highlightTermsInElement wraps active search matches in mark elements.
    private highlightTermsInElement(element: HTMLElement, terms: string[]): void {
        const pattern = this.buildHighlightPattern(terms);
        if (!pattern) {
            return;
        }

        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (!node.textContent || !pattern.test(node.textContent)) {
                    return NodeFilter.FILTER_REJECT;
                }
                pattern.lastIndex = 0;
                return NodeFilter.FILTER_ACCEPT;
            },
        });

        const textNodes: Text[] = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode as Text);
        }

        textNodes.forEach(node => {
            const text = node.textContent || '';
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;

            text.replace(pattern, (match, _group, offset) => {
                if (offset > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)));
                }

                const mark = document.createElement('mark');
                mark.className = 'search-match';
                mark.textContent = match;
                fragment.appendChild(mark);
                lastIndex = offset + match.length;
                return match;
            });

            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
            }

            node.replaceWith(fragment);
            pattern.lastIndex = 0;
        });
    }

    // buildHighlightPattern creates a safe search highlight pattern.
    private buildHighlightPattern(terms: string[]): RegExp | null {
        const escapedTerms = terms
            .map(term => term.trim())
            .filter(term => term.length > 1)
            .sort((a, b) => b.length - a.length)
            .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

        if (escapedTerms.length === 0) {
            return null;
        }

        return new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    }
}
