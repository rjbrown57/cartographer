export function toggleDropdown(dropdownId) {
    const dropdownElement = document.getElementById(dropdownId);
    console.log('Toggling dropdown ' + dropdownId);
    if (dropdownElement) {
        dropdownElement.classList.toggle('is-hidden');
    }
    else {
        console.error('Dropdown element' + dropdownId + 'not found');
    }
}
export function AddDropDownElement(dropDown, href, item) {
    const barLink = document.createElement('div');
    const barItem = document.createElement('a');
    barItem.className = 'dropdown-item-link';
    barItem.href = href;
    barItem.textContent = item;
    barLink.appendChild(barItem);
    dropDown.appendChild(barLink);
}
