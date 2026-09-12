export type ColorScope = 'namespace' | 'source' | 'noteType';

export type ColorPreferences = Record<ColorScope, Record<string, string>>;

type ColorStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const ColorStorageKey = 'cartographer_color_preferences';
const LegacyNamespaceColorStorageKey = 'cartographer_namespace_colors';
const ColorPattern = /^#[0-9a-f]{6}$/;
const ColorScopes: ColorScope[] = ['namespace', 'source', 'noteType'];

// EmptyColorPreferences returns a fresh preference collection for every color scope.
function EmptyColorPreferences(): ColorPreferences {
    return {
        namespace: {},
        source: {},
        noteType: {},
    };
}

// ReadStoredObject parses one localStorage object without exposing malformed browser data.
function ReadStoredObject(storage: ColorStorage, key: string): Record<string, unknown> {
    try {
        const value = storage.getItem(key);
        return value ? JSON.parse(value) as Record<string, unknown> : {};
    } catch {
        return {};
    }
}

// NormalizeColorKey makes logical group names stable across capitalization differences.
function NormalizeColorKey(key: string): string {
    return key.trim().toLowerCase();
}

// NormalizeColor accepts only six-digit CSS hex colors.
function NormalizeColor(color: unknown): string | null {
    if (typeof color !== 'string') {
        return null;
    }
    const normalized = color.toLowerCase();
    return ColorPattern.test(normalized) ? normalized : null;
}

// GetColorPreferences reads validated preferences and includes legacy namespace colors.
export function GetColorPreferences(storage: ColorStorage = localStorage): ColorPreferences {
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

// GetColor returns one browser color preference by logical scope and key.
export function GetColor(scope: ColorScope, key: string, storage: ColorStorage = localStorage): string | null {
    return GetColorPreferences(storage)[scope][NormalizeColorKey(key)] || null;
}

// SetColor saves or resets one browser color preference.
export function SetColor(scope: ColorScope, key: string, color: string | null, storage: ColorStorage = localStorage): void {
    const normalizedKey = NormalizeColorKey(key);
    if (!normalizedKey) {
        return;
    }

    const preferences = GetColorPreferences(storage);
    if (color === null) {
        delete preferences[scope][normalizedKey];
    } else {
        const normalizedColor = NormalizeColor(color);
        if (!normalizedColor) {
            throw new Error('Color must be a six-digit hex value.');
        }
        preferences[scope][normalizedKey] = normalizedColor;
    }

    storage.setItem(ColorStorageKey, JSON.stringify(preferences));
    storage.removeItem(LegacyNamespaceColorStorageKey);
}

// ApplyUserColor sets the shared CSS hook used by user-colored UI elements.
export function ApplyUserColor(element: HTMLElement, color: string | null): void {
    element.classList.toggle('user-colored', Boolean(color));
    if (color) {
        element.style.setProperty('--user-color', color);
        return;
    }
    element.style.removeProperty('--user-color');
}
