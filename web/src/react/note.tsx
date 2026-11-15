import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import type { NoteData } from '../shared/types.js';
import { invalidateCache } from '../components/cache.js';
import { FormatData, GetWritingStatistics, IsValidNamespace, NormalizeTimestamp, ParseCommaList, ParseDataValue, ResolveReturnPath } from '../noteEditor.js';
import { RenderMarkdown } from '../shared/markdown.js';
import { GetAdminSession, GetNamespaces, GetNotes, RequestJSON } from './api.js';
import { DiagramCanvas } from './DiagramCanvas.js';
import { DiagramData, DiagramSize, GetDiagramScene, MaxDiagramBytes, type DiagramScene } from './diagram.js';

type Mode = 'read' | 'create' | 'edit';
type EditorMode = 'write' | 'split' | 'preview';
type Template = { id: string; name: string; body: string; tags?: string[] };
type Draft = { title: string; body: string; namespace: string; url: string; tags: string; source: string; author: string; data: string };

const params = new URLSearchParams(location.search);
const initialMode: Mode = params.get('mode') === 'create' ? 'create' : params.get('mode') === 'edit' ? 'edit' : 'read';
const initialNamespace = params.get('namespace') || 'default';
const returnPath = ResolveReturnPath(params.get('returnTo'), location.origin) || `/?namespace=${encodeURIComponent(initialNamespace)}`;
const emptyScene: DiagramScene = { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} };
const markdownExtensions = [markdown(), EditorView.lineWrapping];

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
  const [diagram, setDiagram] = useState(params.get('type') === 'diagram');
  const [diagramDirty, setDiagramDirty] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const sceneRef = useRef<DiagramScene>(emptyScene);
  const sceneBaselineRef = useRef(JSON.stringify(emptyScene));
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(draft) !== baseline || diagramDirty;

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
      if (loaded) {
        const next = ToDraft(loaded, initialNamespace); setDraft(next); setBaseline(JSON.stringify(next));
        const scene = GetDiagramScene(loaded);
        if (scene) { sceneRef.current = scene; sceneBaselineRef.current = JSON.stringify(scene); setDiagram(true); }
      }
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

  useEffect(() => {
    if (note?.title) document.title = note.title;
  }, [note?.title]);

  useEffect(() => {
    if (!admin || mode === 'read') return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
      if (event.key === 'Escape') setDetailsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [admin, mode]);

  // ChangeDraft updates one field without mutating the current note.
  function ChangeDraft(key: keyof Draft, value: string): void { setDraft(current => ({ ...current, [key]: value })); }

  // ChangeEditorMode persists the user's preferred writing view.
  function ChangeEditorMode(next: EditorMode): void { setEditorMode(next); localStorage.setItem('cartographer_note_editor_mode', next); }

  // CancelEditing protects unsaved changes and returns to the reader or list.
  function CancelEditing(): void {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    if (note) { const next = ToDraft(note, namespace); setDraft(next); setBaseline(JSON.stringify(next)); sceneRef.current = GetDiagramScene(note) || emptyScene; sceneBaselineRef.current = JSON.stringify(sceneRef.current); setDiagramDirty(false); setMode('read'); }
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
    if (saving) return;
    const parsed = diagram ? null : ParseDataValue(draft.data);
    if (!draft.title.trim() || (!diagram && !draft.body.trim())) { setStatus(diagram ? 'Title is required.' : 'Title and Markdown body are required.'); return; }
    if (!IsValidNamespace(draft.namespace)) { setStatus('Use a valid lowercase namespace.'); return; }
    if (parsed?.error) { setStatus(parsed.error); return; }
    const data = diagram ? DiagramData(sceneRef.current) : parsed?.value || undefined;
    if (diagram && DiagramSize(data as Record<string, unknown>) > MaxDiagramBytes) { setStatus('Diagram exceeds the 2 MiB limit. Remove some images or elements.'); return; }
    const id = note?.id || crypto.randomUUID();
    const payload = { id, title: draft.title.trim(), body: draft.body, namespace: draft.namespace, url: draft.url.trim(), tags: ParseCommaList(draft.tags), source: draft.source.trim(), author: draft.author.trim(), data, created_at: NormalizeTimestamp(note?.created_at) || undefined };
    setSaving(true); setStatus('Saving…');
    try {
      await RequestJSON('/v1/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const saved: NoteData = { ...payload, id };
      setNote(saved); setNamespace(draft.namespace); setBaseline(JSON.stringify(draft)); setMode('edit');
      sceneBaselineRef.current = JSON.stringify(sceneRef.current); setDiagramDirty(false);
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
  return <div className={`note-app ${mayEdit ? 'note-app--editing' : ''}`}>
    <header className="note-topbar"><div className="note-topbar__identity"><a className="note-action" href={returnPath} onClick={event => { if (dirty && mode !== 'read' && !confirm('Discard unsaved changes?')) event.preventDefault(); }}>Back</a>
      <a className="note-brand" href="/">{document.getElementById('react-note-root')?.dataset.siteName || 'Cartographer'}</a><span className="note-context">{mode === 'create' ? 'New note' : mode === 'edit' ? 'Edit note' : 'Note'}</span></div>
      <div className="note-topbar__actions">{mode === 'read' && note && <><a className="note-action" href={`/v1/get?${new URLSearchParams({ id: note.id, namespace })}`} target="_blank" rel="noopener noreferrer">Raw</a>{admin && <><button className="note-action" type="button" onClick={() => setMode('edit')}>Edit</button><button className="note-action note-action--danger" type="button" onClick={() => void DeleteNote()}>Delete</button></>}</>}
        {mayEdit && <><span className="note-save-status" role="status">{status || (dirty ? 'Unsaved changes' : 'All changes saved')}</span><button className="note-action" type="button" aria-controls="react-note-details" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}>Details</button><button className="note-action" type="button" onClick={CancelEditing}>Cancel</button><button className="note-action note-action--primary" type="submit" form="react-note-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}</div>
    </header>
    <main className={`note-page ${mayEdit ? 'note-page--editor' : ''}`}><article className={`note-shell ${mayEdit ? 'note-shell--editor' : ''}`}>
      {loading && <p>Loading note…</p>}
      {!loading && status && mode === 'read' && <p role="alert">{status}</p>}
      {!loading && mode === 'read' && note && <><div className="note-reader">
        <div className="note-kicker">{[namespace, note.source, note.author, note.version ? `v${note.version}` : '', note.updated_at ? new Date(NormalizeTimestamp(note.updated_at)).toLocaleDateString() : ''].filter(Boolean).map((value, index) => <span key={index}>{value}</span>)}</div>
        <h1 className="note-title">{note.title || note.url || note.id}</h1>
        {note.url && <a className="note-link" href={note.url} target="_blank" rel="noopener noreferrer"><i className="bi bi-box-arrow-up-right" /> {note.url}</a>}
        {(note.tags || []).length > 0 && <div className="note-tags">{note.tags.map(tag => <a key={tag} className="note-tag" href={`/?namespace=${encodeURIComponent(namespace)}&tag=${encodeURIComponent(tag)}`}>{tag}</a>)}</div>}
        <div className="note-markdown" dangerouslySetInnerHTML={{ __html: RenderMarkdown(note.body || note.url || '') }} />
        {GetDiagramScene(note) && <DiagramCanvas scene={GetDiagramScene(note)!} readOnly />}
        {note.data && !GetDiagramScene(note) && <details className="note-data-section"><summary className="note-data-title">Structured data</summary><pre className="note-data-content">{JSON.stringify(note.data, null, 2)}</pre></details>}
      </div></>}
      {!loading && mode !== 'read' && !admin && <p role="alert">{configured ? 'Admin access is required to author notes. Unlock admin tools from the notes page first.' : 'Note authoring is unavailable because admin authentication is not configured.'}</p>}
      {!loading && mayEdit && <form ref={formRef} id="react-note-form" className="note-editor" onSubmit={event => void SaveNote(event)}>
        <div className="note-editor__main"><div className="note-editor__title-wrap"><label className="note-field"><span className="note-field-label">Title</span><input className="note-editor__title" required value={draft.title} onChange={event => ChangeDraft('title', event.target.value)} placeholder={diagram ? 'Untitled diagram' : 'Untitled note'} /></label>
          {mode === 'create' && <label className="note-field note-editor__type"><span className="note-field-label">Type</span><select className="form-select" value={diagram ? 'diagram' : 'note'} onChange={event => { setDiagram(event.target.value === 'diagram'); sceneRef.current = emptyScene; sceneBaselineRef.current = JSON.stringify(emptyScene); setDiagramDirty(false); }}><option value="note">Note</option><option value="diagram">Diagram</option></select></label>}</div>
          {diagram ? <div className="note-editor__canvas"><DiagramCanvas scene={sceneRef.current} readOnly={false} fill onChange={next => { sceneRef.current = next; setDiagramDirty(current => current || JSON.stringify(next) !== sceneBaselineRef.current); }} /></div> : <><div className="note-editor__toolbar" role="group" aria-label="Writing view"><button type="button" aria-pressed={editorMode === 'write'} onClick={() => ChangeEditorMode('write')}>Write</button><button type="button" aria-pressed={editorMode === 'split'} onClick={() => ChangeEditorMode('split')}>Split</button><button type="button" aria-pressed={editorMode === 'preview'} onClick={() => ChangeEditorMode('preview')}>Preview</button><span className="note-editor__stats">{stats.words} words · {stats.readingTime} · ⌘/Ctrl+S to save</span></div>
          <div className="note-editor__panes" data-mode={editorMode}>{editorMode !== 'preview' && <CodeMirror className="note-editor__code" aria-label="Markdown body" value={draft.body} height="100%" extensions={markdownExtensions} placeholder="Start writing…" onChange={value => ChangeDraft('body', value)} />}
            {editorMode !== 'write' && <div className="note-markdown note-editor__preview note-preview-pane" dangerouslySetInnerHTML={{ __html: RenderMarkdown(draft.body) }} />}</div></>}
        </div>
        {detailsOpen && <aside id="react-note-details" className="note-editor__inspector"><div className="note-editor__inspector-header"><h2>Note details</h2><button className="note-action" type="button" onClick={() => setDetailsOpen(false)} aria-label="Close details">Close</button></div><p>{stats.words} words · {stats.readingTime}</p>
          <label className="note-field">Namespace<input className="form-control" required disabled={Boolean(note)} value={draft.namespace} onChange={event => ChangeDraft('namespace', event.target.value)} list="react-note-namespaces" /></label><datalist id="react-note-namespaces">{namespaces.map(value => <option key={value} value={value} />)}</datalist>
          <label className="note-field">Template<select className="form-select" value="" onChange={event => ApplyTemplate(event.target.value)}><option value="">Choose a template…</option>{templates.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <label className="note-field">URL<input className="form-control" type="url" value={draft.url} onChange={event => ChangeDraft('url', event.target.value)} /></label>
          <label className="note-field">Tags<input className="form-control" value={draft.tags} onChange={event => ChangeDraft('tags', event.target.value)} /></label><div className="note-tag-preview">{ParseCommaList(draft.tags).map(tag => <button className="note-tag-chip" type="button" key={tag} onClick={() => ChangeDraft('tags', ParseCommaList(draft.tags).filter(value => value !== tag).join(', '))}>{tag} ×</button>)}</div>
          <label className="note-field">Source<input className="form-control" value={draft.source} onChange={event => ChangeDraft('source', event.target.value)} /></label>
          <label className="note-field">Author<input className="form-control" value={draft.author} onChange={event => ChangeDraft('author', event.target.value)} /></label>
          {diagram ? <label className="note-field">Description<textarea className="form-control note-data-textarea" aria-label="Markdown description" rows={8} value={draft.body} onChange={event => ChangeDraft('body', event.target.value)} /></label> : <details className="note-data-details"><summary>Structured data</summary><textarea className="form-control note-data-textarea" aria-label="Structured data JSON" value={draft.data} onChange={event => ChangeDraft('data', event.target.value)} /></details>}
          {status && <p role="status">{status}</p>}
        </aside>}
      </form>}
    </article></main>
  </div>;
}

// MountNoteApp mounts the standalone React note entry.
export function MountNoteApp(): void {
  const root = document.getElementById('react-note-root');
  if (root) createRoot(root).render(<NoteApp />);
}

MountNoteApp();
