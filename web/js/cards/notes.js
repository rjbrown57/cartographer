import { TagFilter } from "../components/searchBar.js";
export function RenderMarkdown(markdown) {
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
        return EscapeHTML(markdown).replace(/\n/g, '<br>');
    }
    const rendered = marked.parse(markdown || '');
    if (typeof rendered !== 'string') {
        return EscapeHTML(markdown).replace(/\n/g, '<br>');
    }
    return DOMPurify.sanitize(rendered);
}
function EscapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}
export class Note {
    id;
    displayname;
    title;
    body;
    url;
    tags;
    data;
    self;
    isMaximized = false;
    originalParent = null;
    originalNextSibling = null;
    tagList;
    tagsExpanded = false;
    maxVisibleTags = 8;
    constructor(id, title, body, url, tags, data) {
        this.id = id;
        this.title = title;
        this.displayname = title;
        this.body = body;
        this.url = url;
        this.tags = tags;
        this.data = data;
        this.self = document.createElement('div');
    }
    log() {
        console.log(this);
    }
    render() {
        const card = this.self;
        this.setupCardBase(card);
        const dataText = this.data ? JSON.stringify(this.data, null, 2) : null;
        card.appendChild(this.createCardView(dataText));
        card.appendChild(this.createListRow());
        return card;
    }
    setupCardBase(card) {
        card.id = this.id || this.title;
        card.className = 'link-card note-card';
        card.onclick = (event) => {
            this.handleCardClick(event);
        };
    }
    handleCardClick(event) {
        if (this.isMaximized) {
            return;
        }
        const target = event.target;
        if (target?.closest('a, button, input, textarea, select, label, [role="button"]')) {
            return;
        }
        this.maximize();
    }
    createCardView(dataText) {
        const cardView = document.createElement('div');
        cardView.className = 'card-view';
        const body = this.createBody(dataText);
        const footer = this.createFooter();
        cardView.appendChild(body);
        cardView.appendChild(footer);
        return cardView;
    }
    createBody(dataText) {
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
    createTitleElement(className) {
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
    createNoteActions() {
        const actions = document.createElement('div');
        actions.className = 'note-actions';
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'note-action-button';
        editButton.innerHTML = '<i class="bi bi-pencil-square"></i><span>Edit</span>';
        editButton.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.dispatchEditEvent();
        };
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'note-action-button';
        copyButton.innerHTML = '<i class="bi bi-clipboard"></i><span>Copy</span>';
        copyButton.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.copyTextToClipboard(this.body, () => {
                this.setInlineActionState(copyButton, '<i class="bi bi-check2"></i><span>Copied</span>');
            });
        };
        actions.appendChild(editButton);
        actions.appendChild(copyButton);
        return actions;
    }
    copyTextToClipboard(text, onSuccess) {
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
    setInlineActionState(button, copiedHTML) {
        const originalHTML = button.innerHTML;
        button.innerHTML = copiedHTML;
        button.classList.add('note-action-button--success');
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('note-action-button--success');
        }, 1600);
    }
    dispatchEditEvent() {
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
    createDataContainer(dataText) {
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
    createCopyButton(dataText) {
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
    setCopyButtonState(copyButton, copied) {
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
    createFooter() {
        const footer = document.createElement('div');
        footer.className = 'footer';
        this.tagList = document.createElement('ul');
        this.tagList.className = 'tag-list';
        this.renderTags();
        footer.appendChild(this.tagList);
        return footer;
    }
    createListRow() {
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
    renderTags(showAllOverride = false) {
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
        }
        else if (!showAllOverride && this.tagsExpanded && this.tags.length > this.maxVisibleTags) {
            this.appendTagAction('Show less', () => {
                this.tagsExpanded = false;
                this.renderTags(false);
            });
        }
    }
    appendTagAction(label, action) {
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
    createTagListElement(maxVisible) {
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
    toggleMaximize() {
        if (this.isMaximized) {
            this.minimize();
        }
        else {
            this.maximize();
        }
    }
    maximize() {
        const card = this.self;
        const dataContainer = card.querySelector('.data-container');
        const listRow = card.querySelector('.list-view-row');
        const markdown = card.querySelector('.note-markdown');
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
            const handleKeyDown = (e) => {
                if (e.key === 'Escape' && overlay && overlay.style.display !== 'none') {
                    this.minimize();
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            overlay.keyHandler = handleKeyDown;
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
        overlay.style.display = 'flex';
        if (listRow) {
            listRow.style.display = 'none';
        }
        this.renderTags(true);
        this.isMaximized = true;
    }
    minimize() {
        const card = this.self;
        const dataContainer = card.querySelector('.data-container');
        const listRow = card.querySelector('.list-view-row');
        const markdown = card.querySelector('.note-markdown');
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
        this.tagsExpanded = false;
        this.renderTags(false);
        const gridContainer = document.getElementById("linkgrid");
        if (gridContainer && this.originalParent) {
            card.remove();
            if (this.originalNextSibling) {
                gridContainer.insertBefore(card, this.originalNextSibling);
            }
            else {
                gridContainer.appendChild(card);
            }
        }
        this.isMaximized = false;
    }
    processFilter(filter) {
        if (filter.length === 0) {
            this.show();
            return;
        }
        const searchableText = `${this.title} ${this.body} ${this.url}`.toUpperCase();
        const matchesAll = filter.every(term => searchableText.includes(term.toUpperCase()) ||
            this.tags.some(tag => tag.toUpperCase().includes(term.toUpperCase())));
        if (matchesAll) {
            this.show();
        }
        else {
            this.hide();
        }
    }
    show() {
        this.self.style.display = "";
    }
    hide() {
        this.self.style.display = "none";
    }
    remove() {
        this.self.remove();
    }
}
