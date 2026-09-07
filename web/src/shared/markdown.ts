declare const marked: {
    parse(markdown: string): string | Promise<string>;
};

declare const DOMPurify: {
    sanitize(html: string): string;
};

// RenderMarkdown converts note markdown into sanitized HTML for either UI shell.
export function RenderMarkdown(markdown: string): string {
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
        return EscapeHTML(markdown).replace(/\n/g, '<br>');
    }

    const rendered = marked.parse(markdown || '');
    if (typeof rendered !== 'string') {
        return EscapeHTML(markdown).replace(/\n/g, '<br>');
    }

    return DOMPurify.sanitize(rendered);
}

// EscapeHTML protects the plain-text markdown fallback.
function EscapeHTML(value: string): string {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}
