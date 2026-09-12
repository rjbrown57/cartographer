import { GetColor, SetColor, type ColorScope } from '../preferences/colors.js';

export type ColorPickerOptions = {
    scope: ColorScope;
    key: string;
    label: string;
    fallback: string;
    onChange?: (color: string | null) => void;
    onError?: () => void;
};

// CreateColorPicker builds a reusable browser-backed color picker and reset control.
export function CreateColorPicker(options: ColorPickerOptions): HTMLElement {
    const currentColor = GetColor(options.scope, options.key);
    const control = document.createElement('div');
    control.className = 'color-control';

    const label = document.createElement('label');
    label.className = 'color-control__label';
    label.textContent = options.label;

    const input = document.createElement('input');
    input.className = 'color-control__input';
    input.type = 'color';
    input.value = currentColor || options.fallback;
    input.title = `Choose ${options.label.toLowerCase()} for ${options.key}`;
    input.setAttribute('aria-label', `${options.label} for ${options.key}`);
    label.appendChild(input);
    control.appendChild(label);

    const reset = document.createElement('button');
    reset.className = 'btn btn-sm btn-outline-secondary';
    reset.type = 'button';
    reset.disabled = !currentColor;
    reset.title = `Reset ${options.label.toLowerCase()}`;
    reset.setAttribute('aria-label', `Reset ${options.label.toLowerCase()} for ${options.key}`);
    reset.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
    control.appendChild(reset);

    input.addEventListener('change', () => {
        try {
            SetColor(options.scope, options.key, input.value);
            reset.disabled = false;
            options.onChange?.(input.value);
        } catch {
            input.value = GetColor(options.scope, options.key) || options.fallback;
            options.onError?.();
        }
    });

    reset.addEventListener('click', () => {
        try {
            SetColor(options.scope, options.key, null);
            input.value = options.fallback;
            reset.disabled = true;
            options.onChange?.(null);
        } catch {
            options.onError?.();
        }
    });

    return control;
}
