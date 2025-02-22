const EncodingHeader = {
    headers: {
        'Accept-Encoding': 'gzip'
    }
};
let CartographerData;
let GroupData;
const GetEndpoint = '/v1/get';
const GroupEndpoint = GetEndpoint + '/groups';
const GroupId = 'groupList';
const buttonId = 'groupButton';
export class Cartographer {
    Cards = [];
    constructor() {
        GetGroups().then(() => {
            PopulateDropDown(GroupData, GroupId);
        }, (err) => {
            console.error(err);
        });
        QueryMainData().then(() => {
            CartographerData.links.forEach((link) => {
                this.Cards.push(new Link(link.id, link.displayname, link.url, link.description, link.tags));
            });
            this.showCards();
            this.renderCards();
        }, (err) => {
            console.error(err);
        });
    }
    showCards() {
        this.Cards.forEach((card) => {
            card.log();
        });
    }
    renderCards() {
        const container = document.getElementById("linkgrid");
        if (!container) {
            console.error("Container element not found");
            return;
        }
        this.Cards.forEach((card) => {
            container.appendChild(card.render());
        });
    }
}
function GetQueryPath() {
    let queryUrl = GetEndpoint;
    const urlParams = new URLSearchParams(window.location.search);
    const tag = urlParams.get('tag');
    const group = urlParams.get('group');
    if (tag) {
        queryUrl += "/tags/" + tag;
        return queryUrl;
    }
    if (group) {
        queryUrl += "/groups/" + group;
        return queryUrl;
    }
    return queryUrl;
}
async function QueryMainData() {
    try {
        const response = await fetch(GetQueryPath(), EncodingHeader);
        const data = await response.json();
        CartographerData = data.response;
        console.log(CartographerData);
    }
    catch (err) {
        return console.error(err);
    }
}
async function GetGroups() {
    try {
        const response = await fetch(GroupEndpoint, EncodingHeader);
        const data = await response.json();
        GroupData = data.response;
    }
    catch (err) {
        return console.error(err);
    }
}
class Link {
    id;
    displayname;
    url;
    description;
    tags;
    constructor(id, displayname, url, description, tags) {
        this.id = id;
        this.displayname = displayname;
        this.url = url;
        this.description = description;
        this.tags = tags;
    }
    log() {
        console.log(this);
    }
    render() {
        const card = document.createElement('div');
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
            li.appendChild(tagLink);
            ul.appendChild(li);
        });
        footer.appendChild(ul);
        card.appendChild(footer);
        return card;
    }
    hide() { }
    remove() { }
}
function AddDropDownElement(dropDown, href, item) {
    const barLink = document.createElement('div');
    const barItem = document.createElement('a');
    barItem.className = 'block px-4 py-2 text-sm text-white hover:bg-gray-600';
    barItem.href = href;
    barItem.textContent = item;
    barLink.appendChild(barItem);
    dropDown.appendChild(barLink);
}
function PopulateDropDown(data, elementTarget) {
    const button = document.getElementById(buttonId);
    button.onclick = function () {
        toggleDropdown('groupdropdown');
    };
    const dropDown = document.getElementById(elementTarget);
    for (const item of data.groups) {
        console.log('Adding to group dropdown' + item);
        AddDropDownElement(dropDown, '/?group=' + item, item);
    }
    ;
}
function toggleDropdown(dropdownId) {
    const dropdownElement = document.getElementById(dropdownId);
    console.log('Toggling dropdown' + dropdownId);
    if (dropdownElement) {
        dropdownElement.classList.toggle('hidden');
    }
    else {
        console.error('Dropdown element' + dropdownId + 'not found');
    }
}
