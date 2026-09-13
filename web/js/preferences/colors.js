const ColorStorageKey = 'cartographer_color_preferences';
const LegacyNamespaceColorStorageKey = 'cartographer_namespace_colors';
const ColorPattern = /^#[0-9a-f]{6}$/;
const ColorScopes = ['namespace', 'source', 'noteType'];
function EmptyColorPreferences() {
    return {
        namespace: {},
        source: {},
        noteType: {},
    };
}
function ReadStoredObject(storage, key) {
    try {
        const value = storage.getItem(key);
        return value ? JSON.parse(value) : {};
    }
    catch {
        return {};
    }
}
function NormalizeColorKey(key) {
    return key.trim().toLowerCase();
}
function NormalizeColor(color) {
    if (typeof color !== 'string') {
        return null;
    }
    const normalized = color.toLowerCase();
    return ColorPattern.test(normalized) ? normalized : null;
}
export function GetColorPreferences(storage = localStorage) {
    const preferences = EmptyColorPreferences();
    const stored = ReadStoredObject(storage, ColorStorageKey);
    ColorScopes.forEach((scope) => {
        const values = stored[scope];
        if (!values || typeof values !== 'object' || Array.isArray(values)) {
            return;
        }
        Object.entries(values).forEach(([key, color]) => {
            const normalizedKey = NormalizeColorKey(key);
            const normalizedColor = NormalizeColor(color);
            if (normalizedKey && normalizedColor) {
                preferences[scope][normalizedKey] = normalizedColor;
            }
        });
    });
    Object.entries(ReadStoredObject(storage, LegacyNamespaceColorStorageKey)).forEach(([key, color]) => {
        const normalizedKey = NormalizeColorKey(key);
        const normalizedColor = NormalizeColor(color);
        if (normalizedKey && normalizedColor && !preferences.namespace[normalizedKey]) {
            preferences.namespace[normalizedKey] = normalizedColor;
        }
    });
    return preferences;
}
export function GetColor(scope, key, storage = localStorage) {
    return GetColorPreferences(storage)[scope][NormalizeColorKey(key)] || null;
}
export function SetColor(scope, key, color, storage = localStorage) {
    const normalizedKey = NormalizeColorKey(key);
    if (!normalizedKey) {
        return;
    }
    const preferences = GetColorPreferences(storage);
    if (color === null) {
        delete preferences[scope][normalizedKey];
    }
    else {
        const normalizedColor = NormalizeColor(color);
        if (!normalizedColor) {
            throw new Error('Color must be a six-digit hex value.');
        }
        preferences[scope][normalizedKey] = normalizedColor;
    }
    storage.setItem(ColorStorageKey, JSON.stringify(preferences));
    storage.removeItem(LegacyNamespaceColorStorageKey);
}
export function ApplyUserColor(element, color) {
    element.classList.toggle('user-colored', Boolean(color));
    if (color) {
        element.style.setProperty('--user-color', color);
        return;
    }
    element.style.removeProperty('--user-color');
}
