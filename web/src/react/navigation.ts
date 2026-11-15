const namespaceKey = 'cartographer_selected_namespace';

// GetCurrentNamespace resolves the URL, stored preference, and default in order.
export function GetCurrentNamespace(search = window.location.search): string {
  return new URLSearchParams(search).get('namespace')?.trim() || localStorage.getItem(namespaceKey)?.trim() || 'default';
}

// SetCurrentNamespace stores a namespace for navigation across all UI pages.
export function SetCurrentNamespace(namespace: string): void {
  localStorage.setItem(namespaceKey, namespace);
}

// NoteURL constructs a standalone note URL with an optional edit mode.
export function NoteURL(id: string, namespace: string, edit = false): string {
  const query = new URLSearchParams({ id, namespace });
  if (edit) query.set('mode', 'edit');
  return `/note?${query}`;
}
