export interface Card {
    log(): void;
    hide(filter: string): void;
    render(): Node;
    remove(): void;
    show(): void;
    tags: string[];
    displayname: string;
}

export function ShowAllCards(cards: Card[]) {
    cards.forEach(card => {
        card.show();
    });
}
