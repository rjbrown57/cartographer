
let CartographerData = null;
let GroupData = null;

window.onload = function() {
    Query().then(() => {
        CreateCards(CartographerData);
        populateDropDown(GroupData, "groupList");
    });
};

function Query() {

    // We always full group data to allow filter by group 
    fetch("v1/get/groups")
        .then(response => response.json())
        .then(data => {
            GroupData = data["groups"];
            console.log(GroupData);
        })
        .catch(err => console.error(err));

    return fetch(GetQueryPath(), {
                    headers: {
                        'Accept-Encoding': 'gzip'
                    }
                }) 
                .then(response => response.json())
                .then(data => {
                    CartographerData = data;
                    
                    console.log(CartographerData);
                })
                .catch(err => console.error(err));
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
    var input, filter;
    input = document.querySelector('#searchBar input');
   
    // https://www.w3schools.com/jsref/jsref_touppercase.asp
    filter = input.value.toUpperCase();
    
    // https://www.w3schools.com/jsref/jsref_split.asp
    const filterArray = filter.split(" ");
    filterArray.forEach(filter => {
        filterCards(filter);
    });
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
        li.className = 'bg-gray-200 rounded-full px-1 py-1 text-sm font-semibold text-gray-700 mt-1';

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

function populateDropDown(stringList, elementTarget) {
    dropDown = document.getElementById(elementTarget);

    // If we have only a single group we need to convert it to a list
    if (typeof stringList === 'string') {
        stringList = [stringList];
    }

    for (const item of stringList) {

        const barLink = document.createElement('div');
        const barItem = document.createElement('a');
        barItem.className = 'block px-4 py-2 text-sm text-white hover:bg-gray-600';
        barItem.href = '/?group=' + item
        barItem.textContent = item
        barLink.appendChild(barItem);
        dropDown.appendChild(barLink);
    }
}