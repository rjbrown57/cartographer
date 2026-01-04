let activeDropdown: HTMLElement | null = null;
let activeTrigger: HTMLElement | null = null;
let listenerAttached = false;

function closeActiveDropdown() {
    if (activeDropdown) {
        activeDropdown.classList.add('is-hidden');
    }
    activeDropdown = null;
    activeTrigger = null;
}

function ensureListeners() {
    if (listenerAttached) {
        return;
    }
    document.addEventListener('click', (event) => {
        if (!activeDropdown) {
            return;
        }
        const target = event.target as Node | null;
        if (target && (activeDropdown.contains(target) || (activeTrigger && activeTrigger.contains(target)))) {
            return;
        }
        closeActiveDropdown();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeActiveDropdown();
        }
    });
    listenerAttached = true;
}

export function ToggleDropdown(dropdownId: string, triggerId?: string) {
    const dropdownElement = document.getElementById(dropdownId);
    console.log('Toggling dropdown ' + dropdownId);
    if (dropdownElement) {
        ensureListeners();
        const triggerElement = triggerId ? document.getElementById(triggerId) : null;
        const isHidden = dropdownElement.classList.contains('is-hidden');
        if (isHidden) {
            dropdownElement.classList.remove('is-hidden');
            activeDropdown = dropdownElement;
            activeTrigger = triggerElement;
        } else {
            closeActiveDropdown();
        }
    } else {
        console.error('Dropdown element' + dropdownId + 'not found');
    }
}

export function AddDropDownElement(dropDown: HTMLElement, href: string, item: string) {
    const barLink = document.createElement('div');
    const barItem = document.createElement('a');
    barItem.className = 'dropdown-item-link';
    barItem.href = href;
    barItem.textContent = item;
    barLink.appendChild(barItem);
    dropDown.appendChild(barLink);
}
