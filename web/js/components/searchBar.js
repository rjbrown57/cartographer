import * as cards from '../cards/cards.js';
const searchId = 'searchBar';
export class SearchBar {
    filter = [];
    constructor(deck) {
        const search = document.getElementById(searchId);
        search.addEventListener('keyup', () => {
            this.filter = PrepareTerms(search.value.toUpperCase());
            FilterCards(deck, this.filter);
        });
        search.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.addTermsToURL();
            }
        });
    }
    addTermsToURL() {
        const search = document.getElementById(searchId);
        const terms = PrepareTerms(search.value);
        if (terms.length === 0) {
            return;
        }
        const url = new URL(window.location.href);
        url.searchParams.delete('term');
        terms.forEach(term => {
            url.searchParams.append('term', term);
        });
        window.history.pushState({}, '', url.toString());
    }
}
function FilterCards(deck, filter) {
    if (filter.length === 0) {
        cards.ShowAllCards(deck);
        return;
    }
    deck.forEach(card => {
        card.processFilter(filter);
    });
}
export function TagFilter(tag) {
    const searchElement = document.getElementById(searchId);
    if (searchElement) {
        switch (true) {
            case (searchElement.value === ''):
                searchElement.value = tag;
                break;
            case (searchElement.value.includes(tag)):
                searchElement.value = searchElement.value.split(' ').filter(term => term !== tag).join(' ');
                break;
            default:
                searchElement.value += ' ' + tag;
                break;
        }
        const event = new Event('keyup');
        searchElement.dispatchEvent(event);
    }
    console.log('Filtering by tag: ' + tag);
}
function PrepareTerms(filter) {
    const filterArray = filter.split(" ");
    return filterArray.filter(term => term.trim() !== "");
}
