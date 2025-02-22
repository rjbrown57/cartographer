import * as cards from '../cards/cards.js';

const searchId = 'searchBar';

export class SearchBar {
    filter: string[] = [];
    constructor(deck: cards.Card[]) {
        const search = document.getElementById(searchId) as HTMLInputElement;
        search.addEventListener('keyup', () => {
            // https://www.w3schools.com/jsref/jsref_touppercase.asp
            this.filter = PrepareTerms(search.value.toUpperCase());
            FilterCards(deck, this.filter);
        });
    }
}

function FilterCards(deck: cards.Card[], filter: string[]) {

    // if the filter is unset, or emptied, show all cards
    if (filter.length === 0) {
        cards.ShowAllCards(deck);
        return
    }

    deck.forEach(card => {
        filter.forEach(term => {
            card.hide(term);
        });
    });
}

export function TagFilter(tag: string) {
    const searchElement = document.getElementById(searchId) as HTMLInputElement;
    if (searchElement) {
        switch (true) {
            // if the search is empty, set the tag as the
            // search
            case (searchElement.value === ''):
            searchElement.value = tag;
            break;
            // if the tag is already present in the search, do nothing
            case (searchElement.value.includes(tag)):
            searchElement.value = searchElement.value.split(' ').filter(term => term !== tag).join(' ');
            break;
            // append the tag to the search
            default:
            searchElement.value += ' ' + tag;
            break;
        }

        const event = new Event('keyup');
        searchElement.dispatchEvent(event);
    }
    console.log('Filtering by tag: ' + tag);
}

function PrepareTerms(filter: string): string[] {
    const filterArray = filter.split(" ");
    return filterArray.filter(term => term.trim() !== "");
}