
let CartographerData = null;
let GroupData = null;
let EncodingHeader = {
    headers: {
        'Accept-Encoding': 'gzip'
    }
}

window.onload = LoadCartographerData();

function LoadCartographerData() {
    GetGroups().then(() => {
        populateDropDown(GroupData, "groupList");
    }, (error) => {
        console.error(error);
    },
    QueryMainData().then(() => {
        CreateCards(CartographerData);
    }, (error) => {
        console.error(error);
    }));
}

async function GetGroups() {
   try {
        const response = await fetch("v1/get/groups", EncodingHeader);
        const data = await response.json();
        GroupData = data;
        console.log(GroupData);
    } catch (err) {
        return console.error(err);
    }
}

async function QueryMainData() {

    try {
        const response = await fetch(GetQueryPath(), EncodingHeader);
        const data = await response.json();
        CartographerData = data;

        console.log(CartographerData);
    } catch (err) {
        return console.error(err);
    }
}

function GetQueryPath() {
   let queryUrl = "/v1/get";

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

function CreateCards(data) {
        
        const container = document.getElementById("linkgrid");

        let count = 0;
        // we can eventually do something more meaningful here, but to help deal with an overwhelming amount of links, we can shuffle them
        data.links = data.links.sort(() => Math.random() - 0.5);
        for (const item of data.links) {
            if (count >= 100) {
                const card = createCard(item);
                card.style.display = 'none';
                container.appendChild(card);
            } else {
                container.appendChild(createCard(item));
            }
            count++;
        }

        document.getElementById("link").appendChild(container);
}

function searchData() {
    input = document.querySelector('#searchBar input');

    if (input.value.trim() === "") {
        filterCards("");
        return;
    }
   
    // https://www.w3schools.com/jsref/jsref_touppercase.asp
    filter = input.value.toUpperCase();
    
    // https://www.w3schools.com/jsref/jsref_split.asp
    const filterArray = PrepareTerms(filter);
    console.log("Search Terms: " + filterArray);

    // Filterting Algorithm
    // The user supplies space seperated terms
    // These terms can be present in the display name or the tags attached to the link
    // If the display name or tags contain the term, the card is displayed
    // If the display name or tags do not contain the term, the card is hidden
    filterArray.forEach(filter => {
        filterCards(filter);
    });
}

function PrepareTerms(filter) {
    const filterArray = filter.split(" ");
    return filterArray.filter(term => term.trim() !== "");
}

function filterCards(filter) {
    linkList = CartographerData.links;

    linkList.forEach(link => {
        if (link.displayname.toUpperCase().includes(filter) || link.tags.some(tag => tag.toUpperCase().includes(filter))) {
            document.getElementById(link.displayname).style.display = "";
        } else {
            document.getElementById(link.displayname).style.display = "none";
        }
    });
}

function createCard(link) {
    const card = document.createElement('div');

    card.id = link.displayname;
    card.className = 'link-card bg-white shadow-xl rounded-lg p-4 flex flex-col justify-between ring-1 ring-gray-900/5';

    const body = document.createElement('div');
    body.className = 'body';

    const linkElement = document.createElement('a');
    linkElement.href = link.url;
    linkElement.target = '_blank';
    linkElement.className = 'text-blue-500 underline text-lg break-words';
    linkElement.textContent = link.displayname;
    body.appendChild(linkElement);

    const description = document.createElement('p');
    description.className = 'text-gray-700 text-sm mt-2 break-words';
    description.textContent = link.description;
    body.appendChild(description);

    card.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'footer mt-2';

    const ul = document.createElement('ul');
    ul.className = 'flex flex-wrap space-x-2 border-t mt-2 pt-2';

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-tag';
    ul.appendChild(icon);

    link.tags.forEach(tag => {
        const li = document.createElement('li');
        li.className = 'bg-gray-200 rounded-full px-1 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100 mt-1';

        const tagLink = document.createElement('a');
        tagLink.href = "#";
        tagLink.className = 'text-black-500 break-words';
        tagLink.textContent = tag;
        tagLink.onclick = function() {
                        filterCards(tag.toUpperCase());
                    };

        li.appendChild(tagLink);
        ul.appendChild(li);
    });

    footer.appendChild(ul);
    card.appendChild(footer);

    return card;
}

function toggleDropdown(dropdownId) {
    document.getElementById(dropdownId).classList.toggle('hidden');
}

function AddDropDownElement(href, item) {
    const barLink = document.createElement('div');
    const barItem = document.createElement('a');
    barItem.className = 'block px-4 py-2 text-sm text-white hover:bg-gray-600';
    barItem.href = href;
    barItem.textContent = item;
    barLink.appendChild(barItem);
    dropDown.appendChild(barLink);
}

function populateDropDown(data, elementTarget) {
    dropDown = document.getElementById(elementTarget);

    for (const item of data.groups) {
        AddDropDownElement('/?group=' + item, item);
    };
}