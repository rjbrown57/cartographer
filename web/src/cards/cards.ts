export interface Card {
    hide(filter: string): void;
    log(): void;
    remove(): void;
    render(): Node;
    show(): void;
    processFilter(filter: string[]): void;
    tags: string[];
    
    displayname: string;
}

export function ShowAllCards(cards: Card[]) {
    cards.forEach(card => {
        card.show();
    });
}
