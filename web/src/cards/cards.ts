export interface Card {
    hide(filter: string): void;
    log(): void;
    remove(): void;
    renderTable(): HTMLTableRowElement;
    render(): Node;
    show(): void;
    processFilter(filter: string[]): void;
    tags: string[];
    
    displayname: string;
    self: HTMLElement;
}

export function ShowAllCards(cards: Card[]) {
    cards.forEach(card => {
        card.show();
    });
}
