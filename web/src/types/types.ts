import * as dropdown from   '../components/dropDown.js';
import * as cards from '../cards/cards.js';
import { Link } from '../cards/links.js';
import { SearchBar } from '../components/searchBar.js';

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

export type CartoResponse = {
    links: Link[];
    groups: string[];
}

// Cartographer class is used to represent a collection of cards
// move to it's own file
export class Cartographer {
    Cards: cards.Card[] = [];
    SearchBar: SearchBar;
    constructor() {
        GetGroups().then(() => {
            PopulateDropDown(GroupData, GroupId);
        }, (err) => {
            console.error(err);
        });
        QueryMainData().then(() => {
            CartographerData.links.forEach((link) => {
                // If the link has a url, we will add it to the cards
                if (link.url) {
                    this.Cards.push(
                        new Link(link.id, 
                            link.displayname, 
                            link.url, 
                            link.description, 
                            link.tags
                        )
                    );
                }
            });
            this.renderCards();
        }, (err) => {
            console.error(err);
        });
        this.SearchBar = new SearchBar(this.Cards);
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
}    

function GetQueryPath(): string {
    let queryUrl = GetEndpoint;
     const urlParams = new URLSearchParams(window.location.search);
     const tag = urlParams.getAll('tag');
     const group = urlParams.getAll('group');
 
     // http://localhost:8081/v1/get/tags/oci?tag=github
     if (tag.length > 0) {
        queryUrl += "/tags/";
        // need to use the first tag as the query param
        queryUrl += tag[0];
        // add a ? to the query url
        queryUrl += "?";
        // add the rest of the tags as query params
        tag.slice(1).forEach((t) => {
            queryUrl += "&tag=" + t;
        });
        return queryUrl;
     }

     if (group.length > 0) {
        queryUrl += "/groups/" + group[0];
        // add the rest of the groups as query params
        group.slice(1).forEach((g) => {
            queryUrl += "&group=" + g;
        });
        return queryUrl;
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

function PopulateDropDown(data: CartoResponse, elementTarget: string) {
    
    const button = document.getElementById(buttonId) as HTMLElement;
    button.onclick = function() {
        dropdown.ToggleDropdown('groupdropdown');
    };

    const dropDown = document.getElementById(elementTarget) as HTMLElement;

    for (const item of data.groups) {
        console.log('Adding to group dropdown' + item);
        dropdown.AddDropDownElement(dropDown, '/?group=' + item, item);
    };
}