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
    private self: HTMLElement;
    constructor(id: string, displayname: string, url: string, description: string, tags: string[]) {
        this.id = id;
        this.displayname = displayname;
        this.url = url;
        this.description = description;
        this.tags = tags;
        this.self = document.createElement('div');
    }
    log(): void {
        console.log(this);
    }
    render(): Node {
        const card = this.self;
        card.id = this.displayname;
        card.className = 'link-card bg-white shadow-xl rounded-lg p-4 flex flex-col justify-between ring-1 ring-gray-900/5';
        
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
        
        card.appendChild(body);
        
        const footer = document.createElement('div');
        footer.className = 'footer mt-2';
        
        const ul = document.createElement('ul');
        ul.className = 'flex flex-wrap space-x-2 border-t mt-2 pt-2';
        
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-tag';
        ul.appendChild(icon);
        
        this.tags.forEach(tag => {
            const li = document.createElement('li');
            li.className = 'bg-gray-200 rounded-full px-1 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100 mt-1';
        
            const tagLink = document.createElement('a');
            tagLink.href = "#";
            tagLink.className = 'text-black-500 break-words';
            tagLink.textContent = tag;
            tagLink.onclick = function() {
                TagFilter(tag);
            };
            li.appendChild(tagLink);
            ul.appendChild(li);
        });
        
        footer.appendChild(ul);
        card.appendChild(footer);

        return card;
    }
    hide(filter: string): void {
        if (this.displayname.toUpperCase().includes(filter) || this.tags.some(tag => tag.toUpperCase().includes(filter))) {
            this.self.style.display = "";
        } else {
            this.self.style.display = "none";
        }
    }
    show(): void {
        this.self.style.display = "";
    }
    remove(): void {}
}