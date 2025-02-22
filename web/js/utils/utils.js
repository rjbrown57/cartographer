export function toggleDropdown(dropdownId) {
    const dropdownElement = document.getElementById(dropdownId);
    console.log('Toggling dropdown ' + dropdownId);
    if (dropdownElement) {
        dropdownElement.classList.toggle('hidden');
    }
    else {
        console.error('Dropdown element' + dropdownId + 'not found');
    }
}
export function AddDropDownElement(dropDown, href, item) {
    const barLink = document.createElement('div');
    const barItem = document.createElement('a');
    barItem.className = 'block px-4 py-2 text-sm text-white hover:bg-gray-600';
    barItem.href = href;
    barItem.textContent = item;
    barLink.appendChild(barItem);
    dropDown.appendChild(barLink);
}
