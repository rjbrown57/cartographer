import type { NoteData } from '../shared/types.js';

export type NotesResponse = { response?: { notes?: NoteData[] } };
export type NamespaceResponse = { response?: { msg?: string[] } };
export type AdminSession = { admin: boolean; configured: boolean };

// RequestJSON makes same-origin API requests and reports HTTP failures.
export async function RequestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', ...init });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

// GetNotes returns notes from the existing response envelope.
export async function GetNotes(namespace: string, filters: URLSearchParams = new URLSearchParams()): Promise<NoteData[]> {
  const query = new URLSearchParams(filters);
  query.set('namespace', namespace);
  const payload = await RequestJSON<NotesResponse>(`/v1/get?${query}`);
  return payload.response?.notes ?? [];
}

// GetNamespaces returns the names from the existing response envelope.
export async function GetNamespaces(): Promise<string[]> {
  const payload = await RequestJSON<NamespaceResponse>('/v1/get/namespaces');
  return payload.response?.msg ?? [];
}

// GetAdminSession reports the current same-origin admin session.
export async function GetAdminSession(): Promise<AdminSession> {
  return RequestJSON<AdminSession>('/v1/admin/session');
}
