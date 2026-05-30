import { TagFilter } from "../components/searchBar.js";
import * as query from "../query/query.js";
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
    maxVisibleTags = 4;
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
        card.replaceChildren();
        const dataText = this.data ? JSON.stringify(this.data, null, 2) : null;
        card.appendChild(this.createNoteActions());
        card.appendChild(this.createCardView(dataText));
        return card;
    }
    setupCardBase(card) {
        card.id = this.id || this.title;
        const noteType = this.getNoteType();
        card.className = `link-card note-card ${noteType.className}`;
        card.dataset.noteType = noteType.label;
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
    createMetaRow() {
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
        return meta;
    }
    getNoteType() {
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
        actions.appendChild(this.createRawButton());
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
                data: this.data,
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
    createRawButton() {
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
    getRawQueryURL() {
        const rawURL = new URL(query.GetEndpoint, window.location.origin);
        rawURL.searchParams.set('id', this.id);
        rawURL.searchParams.set('namespace', query.GetSelectedNamespace());
        return rawURL.toString();
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
        const markdown = card.querySelector('.note-markdown');
        this.originalParent = card.parentElement;
        this.originalNextSibling = card.nextSibling;
        let overlay = document.getElementById('maximized-card-overlay');
        if (!overlay) {
            const createdOverlay = document.createElement('div');
            createdOverlay.id = 'maximized-card-overlay';
            createdOverlay.className = 'maximized-overlay';
            document.body.appendChild(createdOverlay);
            createdOverlay.addEventListener('click', (e) => {
                if (e.target === createdOverlay) {
                    createdOverlay.activeCard?.minimize();
                }
            });
            const handleKeyDown = (e) => {
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
    minimize() {
        const card = this.self;
        const dataContainer = card.querySelector('.data-container');
        const markdown = card.querySelector('.note-markdown');
        const overlay = document.getElementById('maximized-card-overlay');
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
            }
            else {
                gridContainer.appendChild(card);
            }
        }
        this.isMaximized = false;
    }
    processFilter(filter) {
        if (filter.length === 0) {
            this.refreshSearchHighlights();
            this.show();
            return;
        }
        const searchableText = `${this.title} ${this.body} ${this.url}`.toUpperCase();
        const matchesAll = filter.every(term => searchableText.includes(term.toUpperCase()) ||
            this.tags.some(tag => tag.toUpperCase().includes(term.toUpperCase())));
        if (matchesAll) {
            this.refreshSearchHighlights();
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
    refreshSearchHighlights() {
        const title = this.self.querySelector('.link-title');
        if (title) {
            this.setHighlightedText(title, this.title, this.getSearchTerms());
        }
        const markdown = this.self.querySelector('.note-markdown');
        if (markdown) {
            markdown.innerHTML = RenderMarkdown(this.body);
            this.highlightTermsInElement(markdown, this.getSearchTerms());
        }
        this.renderTags(this.isMaximized);
    }
    getSearchTerms() {
        const urlTerms = new URLSearchParams(window.location.search).getAll('term');
        const searchElement = document.getElementById('searchBar');
        const inputTerms = searchElement?.value.split(/\s+/) || [];
        const terms = [...urlTerms, ...inputTerms]
            .flatMap(term => term.split(/\s+/))
            .map(term => term.trim())
            .filter(term => term.length > 1);
        return Array.from(new Set(terms));
    }
    getActiveTags() {
        const tags = new URLSearchParams(window.location.search)
            .getAll('tag')
            .flatMap(tag => tag.split(/\s+/))
            .map(tag => tag.trim().toLowerCase())
            .filter(tag => tag !== '');
        return new Set(tags);
    }
    tagMatchesActiveSearch(tag) {
        const normalizedTag = tag.toLowerCase();
        const activeTags = this.getActiveTags();
        const activeTerms = this.getSearchTerms().map(term => term.toLowerCase());
        return activeTags.has(normalizedTag) || activeTerms.some(term => normalizedTag.includes(term));
    }
    setHighlightedText(element, value, terms) {
        element.textContent = value;
        this.highlightTermsInElement(element, terms);
    }
    highlightTermsInElement(element, terms) {
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
        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
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
    buildHighlightPattern(terms) {
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
