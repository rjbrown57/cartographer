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
                if (link.url) {
                    this.Cards.push(new Link(link.id, link.displayname, link.url, link.description, link.tags));
                }
            });
            this.renderCards();
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
    const tag = urlParams.getAll('tag');
    const group = urlParams.getAll('group');
    if (tag.length > 0) {
        queryUrl += "/tags/";
        queryUrl += tag[0];
        queryUrl += "?";
        tag.slice(1).forEach((t) => {
            queryUrl += "&tag=" + t;
        });
        return queryUrl;
    }
    if (group.length > 0) {
        queryUrl += "/groups/" + group[0];
        group.slice(1).forEach((g) => {
            queryUrl += "&group=" + g;
        });
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
