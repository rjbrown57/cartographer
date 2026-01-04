import { TagFilter } from "../components/searchBar.js";
export class Link {
    id;
    displayname;
    url;
    description;
    tags;
    data;
    self;
    isMaximized = false;
    originalParent = null;
    originalNextSibling = null;
    tagList;
    tagsExpanded = false;
    maxVisibleTags = 8;
    constructor(id, displayname, url, description, tags, data) {
        this.id = id;
        this.displayname = displayname;
        this.url = url;
        this.description = description;
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
        if (this.data) {
            this.addMaximizeIcon(card);
        }
        const dataText = this.data ? JSON.stringify(this.data, null, 2) : null;
        card.appendChild(this.createCardView(dataText));
        card.appendChild(this.createListRow());
        return card;
    }
    setupCardBase(card) {
        card.id = this.displayname;
        card.className = 'link-card';
    }
    addMaximizeIcon(card) {
        const iconContainer = document.createElement('div');
        iconContainer.className = 'position-absolute top-0 end-0 mt-3 me-3';
        const icon = document.createElement('i');
        icon.className = 'bi bi-arrows-fullscreen link-card__toggle';
        icon.title = 'Maximize';
        icon.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleMaximize();
        };
        iconContainer.appendChild(icon);
        card.appendChild(iconContainer);
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
        const linkElement = document.createElement('a');
        linkElement.href = this.url;
        linkElement.target = '_blank';
        linkElement.rel = 'noopener noreferrer';
        linkElement.className = 'link-title';
        linkElement.title = this.url;
        linkElement.textContent = this.displayname;
        body.appendChild(linkElement);
        const description = document.createElement('p');
        description.className = 'link-description';
        description.textContent = this.description;
        body.appendChild(description);
        if (dataText) {
            body.appendChild(this.createDataContainer(dataText));
        }
        return body;
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
        const titleLink = document.createElement('a');
        titleLink.href = this.url;
        titleLink.target = '_blank';
        titleLink.rel = 'noopener noreferrer';
        titleLink.className = 'list-title';
        titleLink.title = this.url;
        titleLink.textContent = this.displayname;
        titleColumn.appendChild(titleLink);
        const descriptionColumn = document.createElement('div');
        descriptionColumn.className = 'list-description';
        descriptionColumn.textContent = this.description;
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
            const remaining = this.tags.length - this.maxVisibleTags;
            const li = document.createElement('li');
            li.className = 'tag-pill';
            const moreButton = document.createElement('button');
            moreButton.type = 'button';
            moreButton.className = 'tag-action';
            moreButton.textContent = `+${remaining} more`;
            moreButton.onclick = (e) => {
                e.preventDefault();
                this.tagsExpanded = true;
                this.renderTags(this.isMaximized);
            };
            li.appendChild(moreButton);
            this.tagList.appendChild(li);
        }
        else if (!showAllOverride && this.tagsExpanded && this.tags.length > this.maxVisibleTags) {
            const li = document.createElement('li');
            li.className = 'tag-pill';
            const lessButton = document.createElement('button');
            lessButton.type = 'button';
            lessButton.className = 'tag-action';
            lessButton.textContent = 'Show less';
            lessButton.onclick = (e) => {
                e.preventDefault();
                this.tagsExpanded = false;
                this.renderTags(false);
            };
            li.appendChild(lessButton);
            this.tagList.appendChild(li);
        }
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
        const icon = card.querySelector('.link-card__toggle');
        const dataContainer = card.querySelector('.data-container');
        const listRow = card.querySelector('.list-view-row');
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
        card.className = 'link-card';
        if (dataContainer) {
            dataContainer.classList.remove('is-hidden');
        }
        icon.className = 'bi bi-fullscreen-exit link-card__toggle';
        icon.title = 'Minimize';
        overlay.style.display = 'flex';
        if (listRow) {
            listRow.style.display = 'none';
        }
        this.renderTags(true);
        this.isMaximized = true;
    }
    minimize() {
        const card = this.self;
        const icon = card.querySelector('.link-card__toggle');
        const dataContainer = card.querySelector('.data-container');
        const listRow = card.querySelector('.list-view-row');
        const overlay = document.getElementById('maximized-card-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        card.className = 'link-card';
        if (dataContainer) {
            dataContainer.classList.add('is-hidden');
        }
        if (listRow) {
            listRow.style.display = '';
        }
        icon.className = 'bi bi-arrows-fullscreen link-card__toggle';
        icon.title = 'Maximize';
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
        const matchesAll = filter.every(term => this.displayname.toUpperCase().includes(term.toUpperCase()) ||
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
    remove() { }
}
