import { TagFilter } from "../components/searchBar.js";
export class Link {
    id;
    displayname;
    url;
    description;
    tags;
    self;
    constructor(id, displayname, url, description, tags) {
        this.id = id;
        this.displayname = displayname;
        this.url = url;
        this.description = description;
        this.tags = tags;
        this.self = this.renderTable();
    }
    log() {
        console.log(this);
    }
    renderTable() {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-100 cursor-pointer outline-solid outline-1 outline-gray-300 rounded-lg';
        const urlCell = document.createElement('td');
        const linkElement = document.createElement('a');
        linkElement.href = this.url;
        linkElement.target = '_blank';
        linkElement.className = 'text-blue-500 underline break-words';
        linkElement.textContent = this.displayname;
        urlCell.appendChild(linkElement);
        row.appendChild(urlCell);
        const tagsCell = document.createElement('td');
        tagsCell.className = 'flex flex-wrap space-x-2';
        this.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'bg-gray-200 rounded-full px-2 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100';
            tagElement.textContent = tag;
            tagsCell.appendChild(tagElement);
        });
        row.appendChild(tagsCell);
        const descriptionCell = document.createElement('td');
        descriptionCell.className = 'text-gray-700 text-sm break-words';
        descriptionCell.textContent = this.description;
        row.appendChild(descriptionCell);
        return row;
    }
    render() {
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
        console.log("Showing card: " + this.displayname);
        this.self.style.display = "";
    }
    hide() {
        console.log("Hiding card: " + this.displayname);
        this.self.style.display = "none";
    }
    remove() { }
}
