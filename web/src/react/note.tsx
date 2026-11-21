import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { autocompletion, startCompletion } from '@codemirror/autocomplete';
import { CreateNoteLinkSource, type LinkSearchStatus } from './noteLinks.js';
import { markdown } from '@codemirror/lang-markdown';
import { Alert, Autocomplete, Box, Button, Chip, Divider, FormControl, FormLabel, IconButton, Input, Option, Select, Sheet, Stack, Textarea, Tooltip, Typography } from '@mui/joy';
import type { NoteData } from '../shared/types.js';
import { invalidateCache } from '../components/cache.js';
import { FormatData, GetWritingStatistics, IsValidNamespace, NormalizeTimestamp, ParseCommaList, ParseDataValue, ResolveReturnPath } from '../noteEditor.js';
import { RenderMarkdown } from '../shared/markdown.js';
import { GetAdminSession, GetNamespaces, GetNotes, RequestJSON } from './api.js';
import { DiagramCanvas } from './DiagramCanvas.js';
import { DiagramData, DiagramSize, GetDiagramScene, MaxDiagramBytes, type DiagramScene } from './diagram.js';
import { JoyShell } from './JoyShell.js';

type Mode = 'read' | 'create' | 'edit';
type EditorMode = 'write' | 'split' | 'preview';
type Template = { id: string; name: string; body: string; tags?: string[] };
type Draft = { title: string; body: string; namespace: string; url: string; tags: string; source: string; author: string; data: string };

const params = new URLSearchParams(location.search);
const initialMode: Mode = params.get('mode') === 'create' ? 'create' : params.get('mode') === 'edit' ? 'edit' : 'read';
const initialNamespace = params.get('namespace') || 'default';
const returnPath = ResolveReturnPath(params.get('returnTo'), location.origin) || `/?namespace=${encodeURIComponent(initialNamespace)}`;
const emptyScene: DiagramScene = { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} };


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
  const [detailsOpen, setDetailsOpen] = useState(true);
  const sceneRef = useRef<DiagramScene>(emptyScene);
  const sceneBaselineRef = useRef(JSON.stringify(emptyScene));
  const formRef = useRef<HTMLFormElement>(null);
  const [linkStatus, setLinkStatus] = useState<LinkSearchStatus>({ message: '', retry: false });
  const linkIdentity = useRef({ id: note?.id, namespace });
  linkIdentity.current = { id: note?.id, namespace };
  const linkSearch = useMemo(() => CreateNoteLinkSource(() => linkIdentity.current, setLinkStatus), []);
  const markdownExtensions = useMemo(() => [markdown(), EditorView.lineWrapping, autocompletion({ override: [linkSearch.source] })], [linkSearch]);
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

  // GoToHeading focuses the corresponding Markdown heading in the writing pane.
  function GoToHeading(line: number): void {
    ChangeEditorMode('write');
    window.setTimeout(() => {
      const element = document.querySelector('.cm-editor');
      const view = element ? EditorView.findFromDOM(element as HTMLElement) : null;
      if (view) { const position = view.state.doc.line(Math.min(line, view.state.doc.lines)).from; view.dispatch({ selection: { anchor: position }, scrollIntoView: true }); view.focus(); }
    }, 0);
  }

  // ChangeDraft updates one field without mutating the current note.
  function ChangeDraft(key: keyof Draft, value: string): void { setDraft(current => ({ ...current, [key]: value })); }

  // ChangeEditorMode persists the user's preferred writing view.
  function ChangeEditorMode(next: EditorMode): void { setEditorMode(next); localStorage.setItem('cartographer_note_editor_mode', next); }

  // ChangeNoteMode keeps the return URL in sync when switching views in place.
  function ChangeNoteMode(next: 'read' | 'edit'): void {
    const url = new URL(location.href);
    if (next === 'read') url.searchParams.delete('mode');
    else url.searchParams.set('mode', next);
    history.replaceState(null, '', url);
    setMode(next);
  }

  // ChangeNoteType preserves the editor choice when returning to an unsaved note.
  function ChangeNoteType(value: string | null): void {
    const url = new URL(location.href);
    if (value === 'diagram') url.searchParams.set('type', 'diagram');
    else url.searchParams.delete('type');
    history.replaceState(null, '', url);
    setDiagram(value === 'diagram');
    sceneRef.current = emptyScene;
    sceneBaselineRef.current = JSON.stringify(emptyScene);
    setDiagramDirty(false);
  }

  // CancelEditing protects unsaved changes and returns to the reader or list.
  function CancelEditing(): void {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    if (note) { const next = ToDraft(note, namespace); setDraft(next); setBaseline(JSON.stringify(next)); sceneRef.current = GetDiagramScene(note) || emptyScene; sceneBaselineRef.current = JSON.stringify(sceneRef.current); setDiagramDirty(false); ChangeNoteMode('read'); }
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
  const outline = draft.body.split("\n").map((text, line) => ({ match: /^(#{1,6})\s+(.+)/.exec(text), line: line + 1 })).filter(item => item.match).map(item => ({ line: item.line, level: item.match![1].length, title: item.match![2] }));
  const siteName = document.getElementById('react-note-root')?.dataset.siteName || 'Cartographer';
  return <JoyShell><Box className={`joy-note-app ${mayEdit ? 'joy-note-app--editing' : ''}`}>
    <Sheet component="header" variant="outlined" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: { xs: 1.5, md: 2.5 }, py: 1, borderLeft: 0, borderTop: 0, borderRight: 0, boxShadow: 'sm', zIndex: 2 }}>
      <Tooltip title="Back to notes"><IconButton component="a" href={returnPath} variant="plain" color="neutral" aria-label="Back to notes" onClick={event => { if (dirty && mode !== 'read' && !confirm('Discard unsaved changes?')) event.preventDefault(); }}><i className="bi bi-arrow-left" /></IconButton></Tooltip>
      <Typography component="a" href="/" level="title-lg" sx={{ color: 'text.primary', textDecoration: 'none', fontFamily: 'display' }}>{siteName}</Typography>
      <Typography level="body-sm" sx={{ color: 'text.secondary', borderLeft: '1px solid #cbd5e1', pl: 1.5 }}>{mode === 'create' ? 'New note' : mode === 'edit' ? 'Edit note' : 'Note'}</Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ ml: 'auto' }}>
        {mode === 'read' && note && <><Tooltip title="Raw JSON"><IconButton component="a" href={`/v1/get?${new URLSearchParams({ id: note.id, namespace })}`} target="_blank" rel="noopener noreferrer" variant="outlined" color="neutral" aria-label="Raw JSON"><i className="bi bi-code-slash" /></IconButton></Tooltip>{admin && <><Tooltip title="Edit note"><IconButton onClick={() => ChangeNoteMode('edit')} aria-label="Edit note"><i className="bi bi-pencil" /></IconButton></Tooltip><Tooltip title="Delete note"><IconButton variant="outlined" color="danger" onClick={() => void DeleteNote()} aria-label="Delete note"><i className="bi bi-trash" /></IconButton></Tooltip></>}</>}
        {mayEdit && <><Typography level="body-xs" role="status" sx={{ display: { xs: 'none', sm: 'block' }, color: dirty ? 'warning.700' : 'text.tertiary' }}>{status || (dirty ? 'Unsaved changes' : 'All changes saved')}</Typography><Tooltip title="Note details"><IconButton variant="outlined" color="neutral" aria-label="Note details" aria-controls="react-note-details" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}><i className="bi bi-sliders2" /></IconButton></Tooltip><Tooltip title="Cancel editing"><IconButton variant="plain" color="neutral" aria-label="Cancel editing" onClick={CancelEditing}><i className="bi bi-x-lg" /></IconButton></Tooltip><Tooltip title={saving ? 'Saving…' : 'Save note'}><IconButton type="submit" form="react-note-form" disabled={saving} aria-label={saving ? 'Saving note' : 'Save note'}><i className="bi bi-check2" /></IconButton></Tooltip></>}
      </Stack>
    </Sheet>
    {loading && <Typography sx={{ p: 3 }}>Loading note…</Typography>}
    {!loading && status && mode === 'read' && <Alert color="danger" sx={{ m: 3 }}>{status}</Alert>}
    {!loading && mode === 'read' && note && <Box component="main" sx={{ maxWidth: 960, mx: 'auto', px: { xs: 1.5, md: 3 }, py: 3 }}><Sheet component="article" variant="outlined" sx={{ p: { xs: 2, md: 4 }, borderRadius: 'md', boxShadow: 'sm' }}>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', mb: 1.5 }}>{[namespace, note.source, note.author, note.version ? `v${note.version}` : '', note.updated_at ? new Date(NormalizeTimestamp(note.updated_at)).toLocaleDateString() : ''].filter(Boolean).map((value, index) => <Chip key={index} size="sm" variant="soft" color="neutral" sx={{ borderRadius: 'sm' }}>{value}</Chip>)}</Stack>
      <Typography level="h1" sx={{ mb: 2, overflowWrap: 'anywhere' }}>{note.title || note.url || note.id}</Typography>
      {note.url && <Typography component="a" href={note.url} target="_blank" rel="noopener noreferrer" sx={{ display: 'block', mb: 2, overflowWrap: 'anywhere' }}><i className="bi bi-box-arrow-up-right" /> {note.url}</Typography>}
      {(note.tags || []).length > 0 && <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mb: 2 }}>{note.tags.map(tag => <Button component="a" key={tag} size="sm" variant="soft" color="neutral" sx={{ borderRadius: 'sm', bgcolor: 'background.level1', color: 'text.primary', '&:hover': { bgcolor: 'background.level2' } }} href={`/?namespace=${encodeURIComponent(namespace)}&tag=${encodeURIComponent(tag)}`}>{tag}</Button>)}</Stack>}
      <Box className="joy-markdown" dangerouslySetInnerHTML={{ __html: RenderMarkdown(note.body || note.url || '') }} />
      {GetDiagramScene(note) && <DiagramCanvas scene={GetDiagramScene(note)!} readOnly />}
      {note.data && !GetDiagramScene(note) && <Box component="details" sx={{ mt: 2 }}><Typography component="summary" level="title-sm">Structured data</Typography><Box component="pre" sx={{ overflow: 'auto', bgcolor: '#0f172a', color: '#e2e8f0', p: 2, borderRadius: 'sm' }}>{JSON.stringify(note.data, null, 2)}</Box></Box>}
    </Sheet></Box>}
    {!loading && mode !== 'read' && !admin && <Alert color="warning" sx={{ m: 3 }}>{configured ? 'Admin access is required to author notes. Unlock admin tools from the notes page first.' : 'Note authoring is unavailable because admin authentication is not configured.'}</Alert>}
    {!loading && mayEdit && <Box component="form" ref={formRef} id="react-note-form" className="joy-note-editor" onSubmit={event => void SaveNote(event)}>
      {detailsOpen && <Sheet component="aside" id="react-note-details" className="joy-note-details"><Stack direction="row" alignItems="center" sx={{ mb: 1 }}><Typography level="h2" sx={{ flex: 1 }}>Note details</Typography><IconButton variant="plain" aria-label="Close details" onClick={() => setDetailsOpen(false)}><i className="bi bi-x-lg" /></IconButton></Stack><Typography level="body-sm" sx={{ mb: 2 }}>{stats.words} words · {stats.readingTime}</Typography><Divider sx={{ mb: 2 }} /><Typography level="title-md">Outline</Typography><Stack sx={{ mb: 2 }}>{outline.length ? outline.map(item => <Button key={item.line} variant="plain" color="neutral" size="sm" sx={{ justifyContent: 'start', pl: item.level }} onClick={() => GoToHeading(item.line)}>{item.title}</Button>) : <Typography level="body-sm">Add Markdown headings to build an outline.</Typography>}</Stack>
      <Stack spacing={2}>
        <FormControl><FormLabel>Namespace</FormLabel><Autocomplete freeSolo options={namespaces} inputValue={draft.namespace} onInputChange={(_, value) => ChangeDraft('namespace', value)} disabled={Boolean(note)} /></FormControl>
        <FormControl><FormLabel>Template</FormLabel><Select<string> value={null} placeholder="Choose a template…" onChange={(_, value) => { if (value) ApplyTemplate(value); }}>{templates.map(value => <Option key={value.id} value={value.id}>{value.name}</Option>)}</Select></FormControl>
        <FormControl><FormLabel>URL</FormLabel><Input type="url" value={draft.url} onChange={event => ChangeDraft('url', event.target.value)} /></FormControl>
        <FormControl><FormLabel>Tags</FormLabel><Input value={draft.tags} onChange={event => ChangeDraft('tags', event.target.value)} placeholder="Comma separated" /></FormControl>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>{ParseCommaList(draft.tags).map(tag => <Button size="sm" variant="soft" color="neutral" key={tag} onClick={() => ChangeDraft('tags', ParseCommaList(draft.tags).filter(value => value !== tag).join(', '))}>{tag} ×</Button>)}</Stack>
        <FormControl><FormLabel>Source</FormLabel><Input value={draft.source} onChange={event => ChangeDraft('source', event.target.value)} /></FormControl>
        <FormControl><FormLabel>Author</FormLabel><Input value={draft.author} onChange={event => ChangeDraft('author', event.target.value)} /></FormControl>
        {diagram ? <FormControl><FormLabel>Markdown description</FormLabel><Textarea minRows={8} value={draft.body} onChange={event => ChangeDraft('body', event.target.value)} /></FormControl> : <FormControl><FormLabel>Structured data (JSON)</FormLabel><Textarea minRows={8} value={draft.data} onChange={event => ChangeDraft('data', event.target.value)} /></FormControl>}
        {status && <Alert color={status.startsWith('Unable') || status.startsWith('Diagram exceeds') ? 'danger' : 'neutral'}>{status}</Alert>}
      </Stack>
    </Sheet>}
      <Box className="joy-note-editor-main">
        <Sheet variant="outlined" sx={{ display: 'flex', alignItems: 'end', gap: 1.5, flexWrap: 'wrap', p: { xs: 1, md: 1.5 }, borderLeft: 0, borderTop: 0, borderRight: 0 }}>
          <FormControl sx={{ flex: 1, minWidth: 190 }}><FormLabel>Title</FormLabel><Input required size="lg" value={draft.title} onChange={event => ChangeDraft('title', event.target.value)} placeholder={diagram ? 'Untitled diagram' : 'Untitled note'} /></FormControl>
          {mode === 'create' && <FormControl sx={{ minWidth: 140 }}><FormLabel>Type</FormLabel><Select value={diagram ? 'diagram' : 'note'} onChange={(_, value) => ChangeNoteType(value)}><Option value="note">Note</Option><Option value="diagram">Diagram</Option></Select></FormControl>}
        </Sheet>
        {diagram ? <Box className="joy-note-canvas"><DiagramCanvas scene={sceneRef.current} readOnly={false} fill onChange={(next, initial) => { sceneRef.current = next; if (initial) sceneBaselineRef.current = JSON.stringify(next); else setDiagramDirty(current => current || JSON.stringify(next) !== sceneBaselineRef.current); }} /></Box> : <>
          <Sheet variant="soft" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.75, borderBottom: '1px solid #cbd5e1' }}><Button size="sm" variant={editorMode === 'write' ? 'solid' : 'plain'} onClick={() => ChangeEditorMode('write')}>Write</Button><Button size="sm" variant={editorMode === 'split' ? 'solid' : 'plain'} onClick={() => ChangeEditorMode('split')}>Split</Button><Button size="sm" variant={editorMode === 'preview' ? 'solid' : 'plain'} onClick={() => ChangeEditorMode('preview')}>Preview</Button><Typography level="body-xs" sx={{ ml: 'auto', display: { xs: 'none', sm: 'block' } }}>{stats.words} words · {stats.readingTime} · ⌘/Ctrl+S</Typography></Sheet>
          {linkStatus.message && <Stack direction="row" spacing={1} sx={{ px: 1.5 }}><Typography role="status" level="body-sm">{linkStatus.message}</Typography>{linkStatus.retry && <Button size="sm" variant="plain" onClick={async () => { await linkSearch.retry(); const element = document.querySelector('.cm-editor'); const view = element ? EditorView.findFromDOM(element as HTMLElement) : null; if (view) { view.focus(); startCompletion(view); } }}>Retry</Button>}</Stack>}
          <Box className="joy-note-panes" data-mode={editorMode}>{editorMode !== 'preview' && <CodeMirror className="joy-note-code" aria-label="Markdown body" value={draft.body} height="100%" extensions={markdownExtensions} placeholder="Start writing…" onChange={value => ChangeDraft('body', value)} />}{editorMode !== 'write' && <Box className="joy-markdown joy-note-preview" dangerouslySetInnerHTML={{ __html: RenderMarkdown(draft.body) }} />}</Box>
        </>}
      </Box>
    </Box>}

  </Box></JoyShell>;
}

// MountNoteApp mounts the standalone React note entry.
export function MountNoteApp(): void {
  const root = document.getElementById('react-note-root');
  if (root) createRoot(root).render(<NoteApp />);
}

MountNoteApp();
