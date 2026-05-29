import * as cards from "./cards";
import { TagFilter } from "../components/searchBar.js";

declare const marked: {
    parse(markdown: string): string | Promise<string>;
};

declare const DOMPurify: {
    sanitize(html: string): string;
};

// RenderMarkdown renders markdown text through the configured sanitizer.
function RenderMarkdown(markdown: string): string {
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
    private self: HTMLElement;
    private isMaximized: boolean = false;
    private originalParent: HTMLElement | null = null;
    private originalNextSibling: Node | null = null;
    private tagList!: HTMLUListElement;
    private tagsExpanded: boolean = false;
    private readonly maxVisibleTags: number = 8;

    // constructor initializes a note card instance and its base DOM element.
    constructor(id: string, title: string, body: string, url: string, tags: string[], data?: Record<string, any>) {
        this.id = id;
        this.title = title;
        this.displayname = title;
        this.body = body;
        this.url = url;
        this.tags = tags;
        this.data = data;
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
        this.addMaximizeIcon(card);
        const dataText = this.data ? JSON.stringify(this.data, null, 2) : null;
        card.appendChild(this.createCardView(dataText));
        card.appendChild(this.createListRow());
        return card;
    }

    // setupCardBase sets base attributes and classes on the card element.
    private setupCardBase(card: HTMLElement): void {
        card.id = this.id || this.title;
        card.className = 'link-card note-card';
    }

    // addMaximizeIcon adds the expand control to the card.
    private addMaximizeIcon(card: HTMLElement): void {
        const iconContainer = document.createElement('div');
        iconContainer.className = 'position-absolute top-0 end-0 mt-3 me-3';

        const icon = document.createElement('i');
        icon.className = 'bi bi-arrows-fullscreen link-card__toggle';
        icon.title = 'Expand note';
        icon.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleMaximize();
        };

        iconContainer.appendChild(icon);
        card.appendChild(iconContainer);
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
        body.className = 'd-flex flex-column gap-2';

        const title = this.createTitleElement('link-title note-title');
        title.textContent = this.title;
        body.appendChild(title);

        body.appendChild(this.createNoteActions());

        const markdown = document.createElement('div');
        markdown.className = 'link-description note-markdown note-markdown--preview';
        markdown.innerHTML = RenderMarkdown(this.body);
        body.appendChild(markdown);

        if (dataText) {
            body.appendChild(this.createDataContainer(dataText));
        }

        return body;
    }

    // createTitleElement builds a URL link when present, otherwise an expand button.
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

        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.onclick = (event) => {
            event.preventDefault();
            this.toggleMaximize();
        };
        return button;
    }

    // createNoteActions builds note-level actions for editing the current note.
    private createNoteActions(): HTMLElement {
        const actions = document.createElement('div');
        actions.className = 'note-actions';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'note-action-button';
        editButton.innerHTML = '<i class="bi bi-pencil-square"></i><span>Edit note</span>';
        editButton.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.dispatchEditEvent();
        };

        actions.appendChild(editButton);
        return actions;
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
            },
        }));
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
            navigator.clipboard.writeText(dataText).then(() => {
                this.setCopyButtonState(copyButton, true);
            }).catch(err => {
                console.error('Failed to copy: ', err);
                const textArea = document.createElement('textarea');
                textArea.value = dataText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.setCopyButtonState(copyButton, true);
            });
        };

        return copyButton;
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

    // createListRow builds the compact list row view for list layouts.
    private createListRow(): HTMLElement {
        const listRow = document.createElement('div');
        listRow.className = 'list-view-row list-grid';

        const titleColumn = document.createElement('div');
        titleColumn.className = 'd-flex align-items-center';
        const titleElement = this.createTitleElement('list-title note-list-title');
        titleElement.title = this.url || this.title;
        titleElement.textContent = this.title;
        titleColumn.appendChild(titleElement);

        const descriptionColumn = document.createElement('div');
        descriptionColumn.className = 'list-description';
        descriptionColumn.textContent = this.body;

        const tagsColumn = document.createElement('div');
        tagsColumn.className = 'list-tags';
        tagsColumn.appendChild(this.createTagListElement(4));

        listRow.appendChild(titleColumn);
        listRow.appendChild(descriptionColumn);
        listRow.appendChild(tagsColumn);

        return listRow;
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

            const tagLink = document.createElement('a');
            tagLink.href = "#";
            tagLink.className = 'tag-link';
            tagLink.textContent = tag;
            tagLink.onclick = () => {
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

    // createTagListElement creates a compact tag list element with a max visible count.
    private createTagListElement(maxVisible: number): HTMLUListElement {
        const list = document.createElement('ul');
        list.className = 'list-unstyled d-flex flex-wrap gap-2 m-0';

        const visibleTags = this.tags.slice(0, maxVisible);
        visibleTags.forEach(tag => {
            const li = document.createElement('li');
            li.className = 'tag-pill tag-pill--compact';

            const tagLink = document.createElement('a');
            tagLink.href = "#";
            tagLink.className = 'tag-link';
            tagLink.textContent = tag;
            tagLink.onclick = () => {
                TagFilter(tag);
            };

            li.appendChild(tagLink);
            list.appendChild(li);
        });

        if (this.tags.length > maxVisible) {
            const more = document.createElement('span');
            more.className = 'tag-overflow';
            more.textContent = `+${this.tags.length - maxVisible} more`;
            list.appendChild(more);
        }

        return list;
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
        const icon = card.querySelector('.link-card__toggle') as HTMLElement;
        const dataContainer = card.querySelector('.data-container') as HTMLElement;
        const listRow = card.querySelector('.list-view-row') as HTMLElement | null;
        const markdown = card.querySelector('.note-markdown') as HTMLElement | null;

        this.originalParent = card.parentElement;
        this.originalNextSibling = card.nextSibling;

        let overlay = document.getElementById('maximized-card-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'maximized-card-overlay';
            overlay.className = 'maximized-overlay';
            document.body.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.minimize();
                }
            });

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && overlay && overlay.style.display !== 'none') {
                    this.minimize();
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            (overlay as any).keyHandler = handleKeyDown;
        }

        card.remove();
        overlay.appendChild(card);
        card.className = 'link-card note-card';

        if (markdown) {
            markdown.classList.remove('note-markdown--preview');
        }
        if (dataContainer) {
            dataContainer.classList.remove('is-hidden');
        }

        icon.className = 'bi bi-fullscreen-exit link-card__toggle';
        icon.title = 'Collapse note';
        overlay.style.display = 'flex';

        if (listRow) {
            listRow.style.display = 'none';
        }

        this.renderTags(true);
        this.isMaximized = true;
    }

    // minimize restores the card back into the grid.
    minimize(): void {
        const card = this.self;
        const icon = card.querySelector('.link-card__toggle') as HTMLElement;
        const dataContainer = card.querySelector('.data-container') as HTMLElement;
        const listRow = card.querySelector('.list-view-row') as HTMLElement | null;
        const markdown = card.querySelector('.note-markdown') as HTMLElement | null;
        const overlay = document.getElementById('maximized-card-overlay');

        if (overlay) {
            overlay.style.display = 'none';
        }

        card.className = 'link-card note-card';

        if (markdown) {
            markdown.classList.add('note-markdown--preview');
        }
        if (dataContainer) {
            dataContainer.classList.add('is-hidden');
        }
        if (listRow) {
            listRow.style.display = '';
        }

        icon.className = 'bi bi-arrows-fullscreen link-card__toggle';
        icon.title = 'Expand note';

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
            this.show();
            return;
        }

        const searchableText = `${this.title} ${this.body} ${this.url}`.toUpperCase();
        const matchesAll = filter.every(term =>
            searchableText.includes(term.toUpperCase()) ||
            this.tags.some(tag => tag.toUpperCase().includes(term.toUpperCase()))
        );

        if (matchesAll) {
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
}
