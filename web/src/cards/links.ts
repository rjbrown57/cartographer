import * as cards from "./cards";
import { TagFilter } from "../components/searchBar.js";

// Link class implements Card interface
// Link class is used to represent a link card
export class Link implements cards.Card {
    id: string;
    displayname: string;
    url: string;
    description: string;
    tags: string[];
    data?: Record<string, any>;
    private self: HTMLElement;
    private isMaximized: boolean = false;
    private originalParent: HTMLElement | null = null;
    private originalNextSibling: Node | null = null;
    private tagList!: HTMLUListElement;
    private tagsExpanded: boolean = false;
    private readonly maxVisibleTags: number = 8;
    
    constructor(id: string, displayname: string, url: string, description: string, tags: string[], data?: Record<string, any>) {
        this.id = id;
        this.displayname = displayname;
        this.url = url;
        this.description = description;
        this.tags = tags;
        this.data = data;
        this.self = document.createElement('div');
    }
    
    log(): void {
        console.log(this);
    }
    
    render(): Node {
        const card = this.self;
        card.id = this.displayname;
        card.className = 'link-card bg-white shadow-xl rounded-lg p-4 flex flex-col justify-between ring-1 ring-gray-900/5 relative';
        
        // Add maximize/minimize icon in top right only if data exists
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
        
        // Add data field if it exists (only visible when maximized)
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
            
            // Add action buttons bar
            const actionBar = document.createElement('div');
            actionBar.className = 'action-bar mt-3 flex gap-2';
            
            const copyButton = document.createElement('button');
            copyButton.className = 'bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1';
            copyButton.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
            copyButton.onclick = () => {
                navigator.clipboard.writeText(JSON.stringify(this.data, null, 2)).then(() => {
                    // Show temporary success feedback
                    const originalText = copyButton.innerHTML;
                    copyButton.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                    copyButton.className = 'bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1';
                    
                    setTimeout(() => {
                        copyButton.innerHTML = originalText;
                        copyButton.className = 'bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1';
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = JSON.stringify(this.data, null, 2);
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    // Show success feedback
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
        
        this.tagList = document.createElement('ul');
        this.tagList.className = 'flex flex-wrap space-x-2 border-t mt-2 pt-2';

        this.renderTags();
        
        footer.appendChild(this.tagList);
        card.appendChild(footer);

        return card;
    }

    private renderTags(showAllOverride: boolean = false): void {
        if (!this.tagList) {
            return;
        }

        this.tagList.innerHTML = '';

        const tagIcon = document.createElement('i');
        tagIcon.className = 'fa-solid fa-tag';
        this.tagList.appendChild(tagIcon);

        const shouldShowAll = showAllOverride || this.tagsExpanded || this.tags.length <= this.maxVisibleTags;
        const visibleTags = shouldShowAll ? this.tags : this.tags.slice(0, this.maxVisibleTags);
        
        visibleTags.forEach(tag => {
            const li = document.createElement('li');
            li.className = 'bg-gray-200 rounded-full px-1 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100 mt-1';
        
            const tagLink = document.createElement('a');
            tagLink.href = "#";
            tagLink.className = 'text-black-500 break-words';
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
            li.className = 'mt-1';

            const moreButton = document.createElement('button');
            moreButton.type = 'button';
            moreButton.className = 'text-blue-600 hover:text-blue-800 text-sm font-semibold';
            moreButton.textContent = `+${remaining} more`;
            moreButton.onclick = (e) => {
                e.preventDefault();
                this.tagsExpanded = true;
                this.renderTags(this.isMaximized);
            };

            li.appendChild(moreButton);
            this.tagList.appendChild(li);
        } else if (!showAllOverride && this.tagsExpanded && this.tags.length > this.maxVisibleTags) {
            const li = document.createElement('li');
            li.className = 'mt-1';

            const lessButton = document.createElement('button');
            lessButton.type = 'button';
            lessButton.className = 'text-blue-600 hover:text-blue-800 text-sm font-semibold';
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
    
    toggleMaximize(): void {
        if (this.isMaximized) {
            this.minimize();
        } else {
            this.maximize();
        }
    }
    
    maximize(): void {
        const card = this.self;
        const icon = card.querySelector('.fa-expand') as HTMLElement;
        const dataContainer = card.querySelector('.data-container') as HTMLElement;
        
        // Store original position
        this.originalParent = card.parentElement;
        this.originalNextSibling = card.nextSibling;
        
        // Create a fixed overlay container if it doesn't exist
        let overlay = document.getElementById('maximized-card-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'maximized-card-overlay';
            overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
            overlay.style.display = 'none';
            document.body.appendChild(overlay);
            
            // Close overlay when clicking outside the card
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.minimize();
                }
            });
            
            // Close overlay with ESC key
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && overlay && overlay.style.display !== 'none') {
                    this.minimize();
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            
            // Store the handler so we can remove it later if needed
            (overlay as any).keyHandler = handleKeyDown;
        }
        
        // Remove card from grid
        card.remove();
        
        // Add card to overlay
        overlay.appendChild(card);
        
        // Update card styles for overlay display
        card.className = 'link-card bg-white shadow-xl rounded-lg p-6 flex flex-col justify-between ring-1 ring-gray-900/5 relative w-full max-w-4xl max-h-[90vh] overflow-y-auto';
        
        // Show data container
        if (dataContainer) {
            dataContainer.classList.remove('hidden');
        }
        
        // Update icon
        icon.className = 'fa-solid fa-compress text-gray-500 hover:text-gray-700 cursor-pointer transition-colors';
        icon.title = 'Minimize';
        
        // Show overlay
        overlay.style.display = 'flex';

        this.renderTags(true);
        
        this.isMaximized = true;
    }
    
    minimize(): void {
        const card = this.self;
        const icon = card.querySelector('.fa-compress') as HTMLElement;
        const dataContainer = card.querySelector('.data-container') as HTMLElement;
        const overlay = document.getElementById('maximized-card-overlay');
        
        // Hide overlay
        if (overlay) {
            overlay.style.display = 'none';
        }
        
        // Restore original card styles
        card.className = 'link-card bg-white shadow-xl rounded-lg p-4 flex flex-col justify-between ring-1 ring-gray-900/5 relative';
        
        // Hide data container
        if (dataContainer) {
            dataContainer.classList.add('hidden');
        }
        
        // Update icon
        icon.className = 'fa-solid fa-expand text-gray-500 hover:text-gray-700 cursor-pointer transition-colors';
        icon.title = 'Maximize';

        // Reset tag view to truncated state
        this.tagsExpanded = false;
        this.renderTags(false);
        
        // Move card back to original position in grid
        const gridContainer = document.getElementById("linkgrid");
        if (gridContainer && this.originalParent) {
            // Remove card from overlay
            card.remove();
            
            // Insert back into grid at original position
            if (this.originalNextSibling) {
                gridContainer.insertBefore(card, this.originalNextSibling);
            } else {
                gridContainer.appendChild(card);
            }
        }
        
        this.isMaximized = false;
    }
    
    processFilter(filter: string[]): void {
        // if the filter is unset, or emptied, show all cards
        if (filter.length === 0) {
            this.show();
            return;
        }
        
        // Check if all terms in the filter array match either the displayname or tags
        const matchesAll = filter.every(term => 
            this.displayname.toUpperCase().includes(term.toUpperCase()) || 
            this.tags.some(tag => tag.toUpperCase().includes(term.toUpperCase()))
        );

        if (matchesAll) {
            this.show();
        } else {
            this.hide();
        }
    }
    
    show(): void {
        this.self.style.display = "";
    }
    
    hide(): void {
        this.self.style.display = "none";
    }
    
    remove(): void {}
}
