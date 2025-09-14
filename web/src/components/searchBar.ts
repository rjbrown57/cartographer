import * as cards from '../cards/cards.js';

const searchId = 'searchBar';



export class SearchBar {
    filter: string[] = [];
    constructor(deck: cards.Card[]) {
        const search = document.getElementById(searchId) as HTMLInputElement;
        if (!search) {
            console.error('Search bar element not found');
            return;
        }
        
        search.addEventListener('keyup', () => {
            // https://www.w3schools.com/jsref/jsref_touppercase.asp
            this.filter = PrepareTerms(search.value.toUpperCase());
            FilterCards(deck, this.filter);
        });
        
        // Handle Enter key press to add terms to URL
        search.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.addTermsToURL();
            }
        });

        // Add global keyboard shortcut listener for Cmd+K (Mac) or Ctrl+K (Windows)
        // Only add if not already added to prevent multiple listeners
        if (!(window as any).searchBarKeyboardListenerAdded) {
            const handleKeyboardShortcut = (event: KeyboardEvent) => {
                // Check for Cmd+K on Mac or Ctrl+K on Windows/Linux
                if ((event.metaKey && event.key === 'k') || (event.ctrlKey && event.key === 'k')) {
                    event.preventDefault();
                    const searchElement = document.getElementById(searchId) as HTMLInputElement;
                    if (searchElement) {
                        searchElement.focus();
                        // Select all text in the search bar for easy replacement
                        searchElement.select();
                    }
                }
            };
            
            document.addEventListener('keydown', handleKeyboardShortcut);
            (window as any).searchBarKeyboardListenerAdded = true;
        }
    }
    
    private addTermsToURL(): void {
        const search = document.getElementById(searchId) as HTMLInputElement;
        const terms = PrepareTerms(search.value);
        
        if (terms.length === 0) {
            return;
        }
        
        // Create URL with search terms as query parameters
        const url = new URL(window.location.href);
        
        // Remove existing term parameters
        url.searchParams.delete('term');
        
        // Add each term as a separate term parameter
        terms.forEach(term => {
            url.searchParams.append('term', term);
        });
        
        // Update the URL without reloading the page
        window.history.pushState({}, '', url.toString());
    }
}

function FilterCards(deck: cards.Card[], filter: string[]) {

    // if the filter is unset, or emptied, show all cards
    if (filter.length === 0) {
        cards.ShowAllCards(deck);
        return
    }

    deck.forEach(card => {
        card.processFilter(filter);
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