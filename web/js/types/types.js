import * as dropdown from '../components/dropDown.js';
import { Link } from '../cards/links.js';
import { SearchBar } from '../components/searchBar.js';
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
    SearchBar;
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
            this.renderTable();
        }, (err) => {
            console.error(err);
        });
        this.SearchBar = new SearchBar(this.Cards);
    }
    showCards() {
        this.Cards.forEach((card) => {
            card.log();
        });
    }
    renderTable() {
        const container = document.getElementById("data");
        if (!container) {
            console.error("Container element not found");
            return;
        }
        const table = document.createElement("table");
        table.className = "table-auto border-collapse border border-gray-400 w-full drop-shadow-lg/25";
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["URL", "Tags", "Description    "].forEach((headerText) => {
            const th = document.createElement("th");
            th.className = "border border-gray-400 px-4 py-2";
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        this.Cards.forEach((card) => {
            tbody.appendChild(card.self);
        });
        table.appendChild(tbody);
        const caption = document.createElement("caption");
        caption.className = "caption-top text-sm text-right py-2";
        caption.textContent = `Total Links: ${this.Cards.length}`;
        table.appendChild(caption);
        container.innerHTML = "";
        container.appendChild(table);
    }
    renderCards() {
        const container = document.getElementById("data");
        if (!container) {
            console.error("Container element not found");
            return;
        }
        container.className = "grid grid-cols-3 gap-4";
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
function PopulateDropDown(data, elementTarget) {
    const button = document.getElementById(buttonId);
    button.onclick = function () {
        dropdown.ToggleDropdown('groupdropdown');
    };
    const dropDown = document.getElementById(elementTarget);
    for (const item of data.groups) {
        console.log('Adding to group dropdown' + item);
        dropdown.AddDropDownElement(dropDown, '/?group=' + item, item);
    }
    ;
}
