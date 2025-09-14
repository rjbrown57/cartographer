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
        card.id = this.displayname;
        card.className = 'link-card bg-white shadow-xl rounded-lg p-4 flex flex-col justify-between ring-1 ring-gray-900/5 relative';
        if (this.data) {
            const iconContainer = document.createElement('div');
            iconContainer.className = 'absolute top-2 right-2 z-10';
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-expand text-gray-500 hover:text-gray-700 cursor-pointer transition-colors';
            icon.title = 'Maximize';
            icon.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMaximize();
            };
            iconContainer.appendChild(icon);
            card.appendChild(iconContainer);
        }
        const body = document.createElement('div');
        body.className = 'body';
        const linkElement = document.createElement('a');
        linkElement.href = this.url;
        linkElement.target = '_blank';
        linkElement.className = 'text-blue-500 underline text-lg break-words';
        linkElement.textContent = this.displayname;
        body.appendChild(linkElement);
        const description = document.createElement('p');
        description.className = 'text-gray-700 text-sm mt-2 break-words';
        description.textContent = this.description;
        body.appendChild(description);
        if (this.data) {
            const dataContainer = document.createElement('div');
            dataContainer.className = 'data-container hidden mt-4';
            dataContainer.id = `data-${this.id}`;
            const dataLabel = document.createElement('h4');
            dataLabel.className = 'text-sm font-semibold text-gray-600 mb-2';
            dataLabel.textContent = 'Data:';
            dataContainer.appendChild(dataLabel);
            const dataContent = document.createElement('pre');
            dataContent.className = 'bg-gray-100 p-3 rounded text-xs overflow-auto max-h-96';
            dataContent.textContent = JSON.stringify(this.data, null, 2);
            dataContainer.appendChild(dataContent);
            const actionBar = document.createElement('div');
            actionBar.className = 'action-bar mt-3 flex gap-2';
            const copyButton = document.createElement('button');
            copyButton.className = 'bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1';
            copyButton.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
            copyButton.onclick = () => {
                navigator.clipboard.writeText(JSON.stringify(this.data, null, 2)).then(() => {
                    const originalText = copyButton.innerHTML;
                    copyButton.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                    copyButton.className = 'bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1';
                    setTimeout(() => {
                        copyButton.innerHTML = originalText;
                        copyButton.className = 'bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1';
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                    const textArea = document.createElement('textarea');
                    textArea.value = JSON.stringify(this.data, null, 2);
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    const originalText = copyButton.innerHTML;
                    copyButton.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                    copyButton.className = 'bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1';
                    setTimeout(() => {
                        copyButton.innerHTML = originalText;
                        copyButton.className = 'bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1';
                    }, 2000);
                });
            };
            actionBar.appendChild(copyButton);
            dataContainer.appendChild(actionBar);
            body.appendChild(dataContainer);
        }
        card.appendChild(body);
        const footer = document.createElement('div');
        footer.className = 'footer mt-2';
        const ul = document.createElement('ul');
        ul.className = 'flex flex-wrap space-x-2 border-t mt-2 pt-2';
        const tagIcon = document.createElement('i');
        tagIcon.className = 'fa-solid fa-tag';
        ul.appendChild(tagIcon);
        this.tags.forEach(tag => {
            const li = document.createElement('li');
            li.className = 'bg-gray-200 rounded-full px-1 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100 mt-1';
            const tagLink = document.createElement('a');
            tagLink.href = "#";
            tagLink.className = 'text-black-500 break-words';
            tagLink.textContent = tag;
            tagLink.onclick = function () {
                TagFilter(tag);
            };
            li.appendChild(tagLink);
            ul.appendChild(li);
        });
        footer.appendChild(ul);
        card.appendChild(footer);
        return card;
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
        const icon = card.querySelector('.fa-expand');
        const dataContainer = card.querySelector('.data-container');
        this.originalParent = card.parentElement;
        this.originalNextSibling = card.nextSibling;
        let overlay = document.getElementById('maximized-card-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'maximized-card-overlay';
            overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
            overlay.style.display = 'none';
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
        card.className = 'link-card bg-white shadow-xl rounded-lg p-6 flex flex-col justify-between ring-1 ring-gray-900/5 relative w-full max-w-4xl max-h-[90vh] overflow-y-auto';
        if (dataContainer) {
            dataContainer.classList.remove('hidden');
        }
        icon.className = 'fa-solid fa-compress text-gray-500 hover:text-gray-700 cursor-pointer transition-colors';
        icon.title = 'Minimize';
        overlay.style.display = 'flex';
        this.isMaximized = true;
    }
    minimize() {
        const card = this.self;
        const icon = card.querySelector('.fa-compress');
        const dataContainer = card.querySelector('.data-container');
        const overlay = document.getElementById('maximized-card-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        card.className = 'link-card bg-white shadow-xl rounded-lg p-4 flex flex-col justify-between ring-1 ring-gray-900/5 relative';
        if (dataContainer) {
            dataContainer.classList.add('hidden');
        }
        icon.className = 'fa-solid fa-expand text-gray-500 hover:text-gray-700 cursor-pointer transition-colors';
        icon.title = 'Maximize';
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
