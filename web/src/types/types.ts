// Card interface allows cards to render themselves
// Move card implementations to their own files/dir
export interface Card {
    log(): void;
    hide(filter: string): void;
    render(): Node;
    remove(): void;
}

const EncodingHeader = {
    headers: {
        'Accept-Encoding': 'gzip'
    }
}

let CartographerData: CartoResponse;
let GroupData: CartoResponse;

const GetEndpoint = '/v1/get';
const GroupEndpoint = GetEndpoint + '/groups';
const GroupId = 'groupList'
const buttonId = 'groupButton'
const searchId = 'searchBar';
let filter: string[] = [];

export type CartoResponse = {
    links: Link[];
    groups: string[];
}

// Cartographer class is used to represent a collection of cards
// move to it's own file
export class Cartographer {
    Cards: Card[] = [];
    constructor() {
        this.ConfigureSearchBar();
        GetGroups().then(() => {
            PopulateDropDown(GroupData, GroupId);
        }, (err) => {
            console.error(err);
        });
        QueryMainData().then(() => {
            CartographerData.links.forEach((link) => {
                this.Cards.push(
                    new Link(link.id, 
                        link.displayname, 
                        link.url, 
                        link.description, 
                        link.tags
                    )
                );
            });
            this.renderCards();
        }, (err) => {
            console.error(err);
        });
    }
    showCards(): void {
        this.Cards.forEach((card) => {
            card.log();
        });
    }
    renderCards(): void {
        const container = document.getElementById("linkgrid");
        if (!container) {
            console.error("Container element not found");
            return;
        }

        this.Cards.forEach((card) => {
            container.appendChild(card.render());
        });
    }
    // A bunch of these methods should be broken apart
    ConfigureSearchBar() {
        const search = document.getElementById(searchId) as HTMLElement;
        search.onkeyup = () => {
            const search = document.getElementById(searchId) as HTMLInputElement;
            // https://www.w3schools.com/jsref/jsref_touppercase.asp
            filter = PrepareTerms(search.value.toUpperCase());
            console.log(filter);   
            this.FilterCards();
        }

    }
    FilterCards() {
        this.Cards.forEach(card => {
            filter.forEach(term => {
                card.hide(term);
            });
        });
    }
}    

function PrepareTerms(filter: string): string[] {
    const filterArray = filter.split(" ");
    return filterArray.filter(term => term.trim() !== "");
}

function GetQueryPath(): string {
    let queryUrl = GetEndpoint;
     const urlParams = new URLSearchParams(window.location.search);
     const tag = urlParams.get('tag');
     const group = urlParams.get('group');
 
     if (tag) {
         queryUrl += "/tags/" + tag;
         return queryUrl
     }  
         
     if (group) {
         queryUrl += "/groups/" + group;
         return queryUrl
     }
 
     return queryUrl
 }
 

async function QueryMainData() {
    try {
        const response = await fetch(GetQueryPath(), EncodingHeader);
        const data = await response.json();
        CartographerData = data.response;
        console.log(CartographerData);
    } catch (err) {
        return console.error(err);
    }
}

async function GetGroups() {
    try {
        const response = await fetch(GroupEndpoint, EncodingHeader);
         const data = await response.json();
         GroupData = data.response;
     } catch (err) {
         return console.error(err);
     }
 }

 
// Link class implements Card interface
// Link class is used to represent a link card
class Link implements Card {
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
            /*
            tagLink.onclick = function() {
                TagFilter(tag);
            };
            */
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
    remove(): void {}
}

function AddDropDownElement(dropDown: HTMLElement, href: string, item: string) {
    const barLink = document.createElement('div');
    const barItem = document.createElement('a');
    barItem.className = 'block px-4 py-2 text-sm text-white hover:bg-gray-600';
    barItem.href = href;
    barItem.textContent = item;
    barLink.appendChild(barItem);
    dropDown.appendChild(barLink);
}

function PopulateDropDown(data: CartoResponse, elementTarget: string) {
    
    const button = document.getElementById(buttonId) as HTMLElement;
    button.onclick = function() {
        toggleDropdown('groupdropdown');
    };

    const dropDown = document.getElementById(elementTarget) as HTMLElement;

    for (const item of data.groups) {
        console.log('Adding to group dropdown' + item);
        AddDropDownElement(dropDown, '/?group=' + item, item);
    };
}

function toggleDropdown(dropdownId: string) {
    const dropdownElement = document.getElementById(dropdownId);
    console.log('Toggling dropdown ' + dropdownId);
    if (dropdownElement) {
        dropdownElement.classList.toggle('hidden');
    } else {
        console.error('Dropdown element' + dropdownId + 'not found');
    }
}