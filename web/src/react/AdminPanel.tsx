import React, { useEffect, useState } from 'react';
import type { NoteData } from '../shared/types.js';
import { getCacheKeys, invalidateCache, isNoteCacheEnabled, setNoteCacheEnabled } from '../components/cache.js';
import { GetColor, SetColor, type ColorScope } from '../preferences/colors.js';
import { RenderMarkdown } from '../shared/markdown.js';
import { GetAdminSession, GetNamespaces, RequestJSON, type AdminSession } from './api.js';

type Template = { id: string; name: string; description?: string; body: string; tags?: string[] };
type Tab = 'templates' | 'namespaces' | 'colors' | 'cache';

// AdminPanel manages sessions, templates, namespaces, and browser preferences.
export function AdminPanel({ notes, onSessionChange, onNamespaceChange, onColorChange }: {
  notes: NoteData[];
  onSessionChange: (admin: boolean) => void;
  onNamespaceChange: () => void;
  onColorChange: () => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<AdminSession>({ admin: false, configured: false });
  const [token, setToken] = useState('');
  const [tab, setTab] = useState<Tab>('templates');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [cacheEnabled, setCacheEnabled] = useState(isNoteCacheEnabled);
  const [colorVersion, setColorVersion] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    void GetAdminSession().then(value => { setSession(value); onSessionChange(value.admin); }).catch(() => setStatus('Unable to check admin session.'));
  }, [onSessionChange]);

  useEffect(() => {
    if (!open || !session.admin) return;
    void RequestJSON<{ templates: Template[] }>('/v1/admin/templates').then(value => setTemplates(value.templates || [])).catch(() => setStatus('Unable to load templates.'));
    void GetNamespaces().then(setNamespaces).catch(() => setStatus('Unable to load namespaces.'));
  }, [open, session.admin]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Login starts an admin session with the existing token endpoint.
  async function Login(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    try {
      const next = await RequestJSON<AdminSession>('/v1/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      setSession(next); onSessionChange(next.admin); setToken(''); setStatus('');
    } catch { setStatus('Unable to sign in. Check the admin token.'); }
  }

  // Logout ends the current admin session.
  async function Logout(): Promise<void> {
    try { await RequestJSON('/v1/admin/session', { method: 'DELETE' }); setSession({ ...session, admin: false }); onSessionChange(false); setStatus('Signed out.'); }
    catch { setStatus('Unable to sign out.'); }
  }

  // EditTemplate fills the form with an existing template or clears it for a new one.
  function EditTemplate(template: Template | null): void {
    setEditing(template); setName(template?.name || ''); setDescription(template?.description || '');
    setTags((template?.tags || []).join(', ')); setBody(template?.body || ''); setPreview(false); setStatus('');
  }

  // SaveTemplate writes the complete template through the admin API.
  async function SaveTemplate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    try {
      await RequestJSON('/v1/admin/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing?.id || '', name, description, body, tags: tags.split(',').map(value => value.trim()).filter(Boolean) }) });
      const list = await RequestJSON<{ templates: Template[] }>('/v1/admin/templates');
      setTemplates(list.templates || []); EditTemplate(null); setStatus('Template saved.');
    } catch { setStatus('Unable to save template.'); }
  }

  // DeleteTemplate removes an admin template after confirmation.
  async function DeleteTemplate(template: Template): Promise<void> {
    if (!confirm(`Delete template “${template.name}”?`)) return;
    try {
      await RequestJSON(`/v1/admin/templates/${encodeURIComponent(template.id)}`, { method: 'DELETE' });
      setTemplates(current => current.filter(value => value.id !== template.id)); setStatus('Template deleted.');
    } catch { setStatus('Unable to delete template.'); }
  }

  // DeleteNamespace removes a namespace and refreshes the desktop browser.
  async function DeleteNamespace(namespace: string): Promise<void> {
    if (!confirm(`Delete namespace “${namespace}” and all notes inside it?`)) return;
    try {
      await RequestJSON(`/v1/admin/namespaces/${encodeURIComponent(namespace)}`, { method: 'DELETE' });
      invalidateCache(); SetColor('namespace', namespace, null);
      setNamespaces(current => current.filter(value => value !== namespace)); onNamespaceChange(); setStatus('Namespace deleted.');
    } catch { setStatus('Unable to delete namespace.'); }
  }

  // ChangeColor writes a browser preference and refreshes card styling.
  function ChangeColor(scope: ColorScope, key: string, value: string | null): void {
    SetColor(scope, key, value); setColorVersion(current => current + 1); onColorChange();
  }

  const colorGroups: Array<[ColorScope, string[]]> = [
    ['namespace', namespaces],
    ['source', [...new Set(notes.map(note => note.source).filter((value): value is string => Boolean(value)))].sort()],
    ['noteType', ['Note', 'Link', 'Data', 'Diagram']],
  ];

  return <><button className="btn nav-action" type="button" onClick={() => setOpen(true)} aria-label="Open admin panel"><i className="bi bi-gear" /> Tools</button>
    {open && <div className="admin-panel" role="dialog" aria-modal="true" aria-label="Admin panel"><div className="note-composer__panel"><div className="admin-panel__scroll">
      <div className="d-flex justify-content-between align-items-center"><h2>Tools</h2><button type="button" className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Close</button></div>
      {status && <p role="status">{status}</p>}
      {!session.configured && <p>Admin authentication is not configured.</p>}
      {session.configured && !session.admin && <form onSubmit={event => void Login(event)}><label htmlFor="react-admin-token">Admin token</label><input id="react-admin-token" className="form-control" type="password" autoComplete="current-password" value={token} onChange={event => setToken(event.target.value)} /><button className="btn btn-primary" type="submit">Sign in</button></form>}
      {session.admin && <><button className="btn btn-outline-secondary" type="button" onClick={() => void Logout()}>Logout</button>
        <div className="admin-tabs" role="tablist">{(['templates', 'namespaces', 'colors', 'cache'] as Tab[]).map(value => <button type="button" role="tab" aria-selected={tab === value} className={`admin-tab ${tab === value ? 'active' : ''}`} onClick={() => setTab(value)} key={value}>{value}</button>)}</div>
        {tab === 'templates' && <section><h3>Templates</h3><ul>{templates.map(template => <li key={template.id}>{template.name} <button type="button" onClick={() => EditTemplate(template)}>Edit</button> <button type="button" onClick={() => void DeleteTemplate(template)}>Delete</button></li>)}</ul>
          <form onSubmit={event => void SaveTemplate(event)}><h4>{editing ? 'Edit template' : 'New template'}</h4>
            <label>Name<input className="form-control" required value={name} onChange={event => setName(event.target.value)} /></label>
            <label>Description<input className="form-control" value={description} onChange={event => setDescription(event.target.value)} /></label>
            <label>Tags<input className="form-control" value={tags} onChange={event => setTags(event.target.value)} /></label>
            <div><button type="button" onClick={() => setPreview(false)}>Write</button><button type="button" onClick={() => setPreview(true)}>Preview</button></div>
            {preview ? <div className="note-markdown" dangerouslySetInnerHTML={{ __html: RenderMarkdown(body) }} /> : <textarea className="form-control" required rows={12} value={body} onChange={event => setBody(event.target.value)} />}
            <button className="btn btn-primary" type="submit">Save template</button>{editing && <button type="button" onClick={() => EditTemplate(null)}>Cancel edit</button>}
          </form></section>}
        {tab === 'namespaces' && <section><h3>Namespaces</h3><ul>{namespaces.map(namespace => <li key={namespace}>{namespace} <button type="button" onClick={() => void DeleteNamespace(namespace)}>Delete</button></li>)}</ul></section>}
        {tab === 'colors' && <section key={colorVersion}><h3>Color meanings</h3>{colorGroups.map(([scope, keys]) => <div key={scope}><h4>{scope}</h4>{keys.map(key => <label key={key}>{key}<input type="color" value={GetColor(scope, key) || '#38bdf8'} onChange={event => ChangeColor(scope, key, event.target.value)} /><button type="button" onClick={() => ChangeColor(scope, key, null)}>Reset</button></label>)}</div>)}</section>}
        {tab === 'cache' && <section><h3>Cache</h3><label><input type="checkbox" checked={cacheEnabled} onChange={event => { setCacheEnabled(event.target.checked); setNoteCacheEnabled(event.target.checked); }} /> Cache notes in this browser</label>
          <p>{getCacheKeys().length} cached queries</p><button type="button" onClick={() => { invalidateCache(); setStatus('Cache cleared.'); }}>Clear cache</button>
          <details><summary>Cached queries</summary><ul>{getCacheKeys().map(key => <li key={key}>{key}</li>)}</ul></details></section>}
      </>}
    </div></div></div>}
  </>;
}
