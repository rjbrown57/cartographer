import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { NoteData } from '../shared/types.js';
import { invalidateCache } from '../components/cache.js';
import { FormatData, GetWritingStatistics, IsValidNamespace, NormalizeTimestamp, ParseCommaList, ParseDataValue, ResolveReturnPath } from '../noteEditor.js';
import { RenderMarkdown } from '../shared/markdown.js';
import { GetAdminSession, GetNamespaces, GetNotes, RequestJSON } from './api.js';

type Mode = 'read' | 'create' | 'edit';
type EditorMode = 'write' | 'split' | 'preview';
type Template = { id: string; name: string; body: string; tags?: string[] };
type Draft = { title: string; body: string; namespace: string; url: string; tags: string; source: string; author: string; data: string };

const params = new URLSearchParams(location.search);
const initialMode: Mode = params.get('mode') === 'create' ? 'create' : params.get('mode') === 'edit' ? 'edit' : 'read';
const initialNamespace = params.get('namespace') || 'default';
const returnPath = ResolveReturnPath(params.get('returnTo'), location.origin) || `/?namespace=${encodeURIComponent(initialNamespace)}`;

// ToDraft converts a stored note into editable form values.
function ToDraft(note: NoteData | null, namespace: string): Draft {
  return { title: note?.title || '', body: note?.body || '', namespace, url: note?.url || '', tags: (note?.tags || []).join(', '), source: note?.source || '', author: note?.author || '', data: FormatData(note?.data) };
}

// NoteApp owns standalone note reading, authoring, and editing.
export function NoteApp(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [editorMode, setEditorMode] = useState<EditorMode>(() => localStorage.getItem('cartographer_note_editor_mode') as EditorMode || 'write');
  const [namespace, setNamespace] = useState(initialNamespace);
  const [note, setNote] = useState<NoteData | null>(null);
  const [draft, setDraft] = useState<Draft>(() => ToDraft(null, initialNamespace));
  const [baseline, setBaseline] = useState(JSON.stringify(ToDraft(null, initialNamespace)));
  const [admin, setAdmin] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(initialMode !== 'create');
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== baseline;

  useEffect(() => {
    let active = true;
    void GetAdminSession().then(value => { if (active) { setAdmin(value.admin); setConfigured(value.configured); } });
    void GetNamespaces().then(value => { if (active) setNamespaces(value); }).catch(() => {});
    void RequestJSON<{ templates: Template[] }>('/v1/admin/templates').then(value => { if (active) setTemplates(value.templates || []); }).catch(() => {});
    if (initialMode === 'create') return () => { active = false; };
    const id = params.get('id');
    if (!id) { setStatus('Missing note id.'); setLoading(false); return () => { active = false; }; }
    void GetNotes(initialNamespace, new URLSearchParams({ id })).then(value => {
      if (!active) return;
      const loaded = value.find(item => item.id === id) || null;
      setNote(loaded);
      if (loaded) { const next = ToDraft(loaded, initialNamespace); setDraft(next); setBaseline(JSON.stringify(next)); }
      else setStatus('Note not found.');
      setLoading(false);
    }).catch(() => { if (active) { setStatus('Unable to load note.'); setLoading(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!dirty || mode === 'read') return;
    const onUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty, mode]);

  // ChangeDraft updates one field without mutating the current note.
  function ChangeDraft(key: keyof Draft, value: string): void { setDraft(current => ({ ...current, [key]: value })); }

  // ChangeEditorMode persists the user's preferred writing view.
  function ChangeEditorMode(next: EditorMode): void { setEditorMode(next); localStorage.setItem('cartographer_note_editor_mode', next); }

  // CancelEditing protects unsaved changes and returns to the reader or list.
  function CancelEditing(): void {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    if (note) { const next = ToDraft(note, namespace); setDraft(next); setBaseline(JSON.stringify(next)); setMode('read'); }
    else location.assign(returnPath);
  }

  // ApplyTemplate appends Markdown and merges template tags into the draft.
  function ApplyTemplate(id: string): void {
    const template = templates.find(value => value.id === id);
    if (!template) return;
    setDraft(current => ({ ...current, body: [current.body.trim(), template.body].filter(Boolean).join('\n\n'), tags: [...new Set([...ParseCommaList(current.tags), ...(template.tags || [])])].join(', ') }));
    ChangeEditorMode('write');
  }

  // SaveNote validates and persists a draft through the existing note endpoint.
  async function SaveNote(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = ParseDataValue(draft.data);
    if (!draft.title.trim() || !draft.body.trim()) { setStatus('Title and Markdown body are required.'); return; }
    if (!IsValidNamespace(draft.namespace)) { setStatus('Use a valid lowercase namespace.'); return; }
    if (parsed.error) { setStatus(parsed.error); return; }
    const id = note?.id || crypto.randomUUID();
    const payload = { id, title: draft.title.trim(), body: draft.body, namespace: draft.namespace, url: draft.url.trim(), tags: ParseCommaList(draft.tags), source: draft.source.trim(), author: draft.author.trim(), data: parsed.value || undefined, created_at: NormalizeTimestamp(note?.created_at) || undefined };
    setSaving(true); setStatus('Saving…');
    try {
      await RequestJSON('/v1/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const saved: NoteData = { ...payload, id, data: parsed.value || undefined };
      setNote(saved); setNamespace(draft.namespace); setBaseline(JSON.stringify(draft)); setMode('edit');
      const url = new URL(location.href); url.searchParams.set('id', id); url.searchParams.set('namespace', draft.namespace); url.searchParams.set('mode', 'edit'); history.replaceState(null, '', url);
      invalidateCache(); setStatus('Saved just now.');
    } catch { setStatus('Unable to save note. Your draft remains in the editor.'); }
    finally { setSaving(false); }
  }

  // DeleteNote removes the note after confirmation and returns to its collection.
  async function DeleteNote(): Promise<void> {
    if (!note || !confirm(`Delete “${note.title}”?`)) return;
    try { await RequestJSON(`/v1/notes?id=${encodeURIComponent(note.id)}&namespace=${encodeURIComponent(namespace)}`, { method: 'DELETE' }); invalidateCache(); location.assign(returnPath); }
    catch { setStatus('Unable to delete note.'); }
  }

  const mayEdit = admin && (mode === 'create' || mode === 'edit');
  const stats = GetWritingStatistics(draft.body);
  return <>
    <header className="note-topbar"><div className="note-topbar__identity"><a className="note-action" href={returnPath} onClick={event => { if (dirty && mode !== 'read' && !confirm('Discard unsaved changes?')) event.preventDefault(); }}>Back</a>
      <a className="note-brand" href="/">{document.getElementById('react-note-root')?.dataset.siteName || 'Cartographer'}</a><span className="note-context">{mode === 'create' ? 'New note' : mode === 'edit' ? 'Edit note' : 'Note'}</span></div>
      <div className="note-topbar__actions">{mode === 'read' && note && <><a className="note-action" href={`/v1/get?${new URLSearchParams({ id: note.id, namespace })}`} target="_blank" rel="noopener noreferrer">Raw</a>{admin && <><button className="note-action" type="button" onClick={() => setMode('edit')}>Edit</button><button className="note-action note-action--danger" type="button" onClick={() => void DeleteNote()}>Delete</button></>}</>}
        {mayEdit && <><span className="note-save-status" role="status">{status || (dirty ? 'Unsaved changes' : 'All changes saved')}</span><button className="note-action" type="button" onClick={CancelEditing}>Cancel</button><button className="note-action note-action--primary" type="submit" form="react-note-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}</div>
    </header>
    <main className="note-page"><article className="note-shell">
      {loading && <p>Loading note…</p>}
      {!loading && status && mode === 'read' && <p role="alert">{status}</p>}
      {!loading && mode === 'read' && note && <><div className="note-reader"><h1>{note.title}</h1><div className="note-markdown" dangerouslySetInnerHTML={{ __html: RenderMarkdown(note.body) }} />
        {note.url && <p><a href={note.url} target="_blank" rel="noopener noreferrer">{note.url}</a></p>}
        {(note.tags || []).length > 0 && <p>{note.tags.map(tag => <a key={tag} className="note-tag-chip" href={`/?namespace=${encodeURIComponent(namespace)}&tag=${encodeURIComponent(tag)}`}>{tag}</a>)}</p>}
        {note.data && <details><summary>Structured data</summary><pre>{JSON.stringify(note.data, null, 2)}</pre></details>}
        <p>{[note.source, note.author, note.version ? `v${note.version}` : '', note.updated_at ? `Updated ${new Date(NormalizeTimestamp(note.updated_at)).toLocaleDateString()}` : ''].filter(Boolean).join(' · ')}</p></div></>}
      {!loading && mode !== 'read' && !admin && <p role="alert">{configured ? 'Admin access is required to author notes. Unlock admin tools from the notes page first.' : 'Note authoring is unavailable because admin authentication is not configured.'}</p>}
      {!loading && mayEdit && <form id="react-note-form" className="note-editor" onSubmit={event => void SaveNote(event)}>
        <div className="note-editor__main"><label className="note-field"><span className="note-field-label">Title</span><input className="form-control" required value={draft.title} onChange={event => ChangeDraft('title', event.target.value)} /></label>
          <div className="note-editor__toolbar"><button type="button" onClick={() => ChangeEditorMode('write')}>Write</button><button type="button" onClick={() => ChangeEditorMode('split')}>Split</button><button type="button" onClick={() => ChangeEditorMode('preview')}>Preview</button></div>
          <div className="note-editor__panes">{editorMode !== 'preview' && <textarea className="form-control note-editor__textarea" aria-label="Markdown body" required rows={20} value={draft.body} onChange={event => ChangeDraft('body', event.target.value)} />}
            {editorMode !== 'write' && <div className="note-markdown note-preview-pane" dangerouslySetInnerHTML={{ __html: RenderMarkdown(draft.body) }} />}</div>
        </div>
        <aside className="note-editor__inspector"><h2>Note details</h2><p>{stats.words} words · {stats.readingTime}</p>
          <label className="note-field">Namespace<input className="form-control" required disabled={Boolean(note)} value={draft.namespace} onChange={event => ChangeDraft('namespace', event.target.value)} list="react-note-namespaces" /></label><datalist id="react-note-namespaces">{namespaces.map(value => <option key={value} value={value} />)}</datalist>
          <label className="note-field">Template<select className="form-select" value="" onChange={event => ApplyTemplate(event.target.value)}><option value="">Choose a template…</option>{templates.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <label className="note-field">URL<input className="form-control" type="url" value={draft.url} onChange={event => ChangeDraft('url', event.target.value)} /></label>
          <label className="note-field">Tags<input className="form-control" value={draft.tags} onChange={event => ChangeDraft('tags', event.target.value)} /></label><div className="note-tag-preview">{ParseCommaList(draft.tags).map(tag => <button className="note-tag-chip" type="button" key={tag} onClick={() => ChangeDraft('tags', ParseCommaList(draft.tags).filter(value => value !== tag).join(', '))}>{tag} ×</button>)}</div>
          <label className="note-field">Source<input className="form-control" value={draft.source} onChange={event => ChangeDraft('source', event.target.value)} /></label>
          <label className="note-field">Author<input className="form-control" value={draft.author} onChange={event => ChangeDraft('author', event.target.value)} /></label>
          <details className="note-data-details"><summary>Structured data</summary><textarea className="form-control note-data-textarea" aria-label="Structured data JSON" value={draft.data} onChange={event => ChangeDraft('data', event.target.value)} /></details>
          {status && <p role="status">{status}</p>}
        </aside>
      </form>}
    </article></main>
  </>;
}

// MountNoteApp mounts the standalone React note entry.
export function MountNoteApp(): void {
  const root = document.getElementById('react-note-root');
  if (root) createRoot(root).render(<NoteApp />);
}

MountNoteApp();
