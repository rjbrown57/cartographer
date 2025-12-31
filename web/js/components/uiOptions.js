const UI_OPTIONS_KEY = 'cartographer_ui_options';
const DEFAULT_UI_OPTIONS = {
    isListView: false,
};
let cachedUIOptions = loadUIOptionsFromStorage();
function loadUIOptionsFromStorage() {
    try {
        const stored = localStorage.getItem(UI_OPTIONS_KEY);
        if (!stored) {
            return { ...DEFAULT_UI_OPTIONS };
        }
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') {
            return { ...DEFAULT_UI_OPTIONS };
        }
        return {
            ...DEFAULT_UI_OPTIONS,
            isListView: Boolean(parsed.isListView),
        };
    }
    catch (err) {
        console.error('Error loading UI options from localStorage:', err);
        return { ...DEFAULT_UI_OPTIONS };
    }
}
function saveUIOptionsToStorage() {
    try {
        localStorage.setItem(UI_OPTIONS_KEY, JSON.stringify(cachedUIOptions));
    }
    catch (err) {
        console.error('Error saving UI options to localStorage:', err);
    }
}
export function getListViewPreference() {
    return cachedUIOptions.isListView;
}
export function setListViewPreference(isListView) {
    if (cachedUIOptions.isListView === isListView) {
        return;
    }
    cachedUIOptions = {
        ...cachedUIOptions,
        isListView,
    };
    saveUIOptionsToStorage();
}
