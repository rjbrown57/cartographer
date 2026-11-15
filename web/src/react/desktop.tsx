import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { NoteData } from '../shared/types.js';
import { getCacheEntry, invalidateCache, isCacheValid, setCacheEntry } from '../components/cache.js';
import { GetColor } from '../preferences/colors.js';
import { GetNoteSortMode, SetNoteSortMode, SortNotes, type NoteSortMode } from '../preferences/noteSort.js';
import { RenderMarkdown } from '../shared/markdown.js';
import { GetAdminSession, GetNamespaces, GetNotes, RequestJSON } from './api.js';
import { GetCurrentNamespace, NoteURL, SetCurrentNamespace } from './navigation.js';
import { AdminPanel } from './AdminPanel.js';

const cardStyleKey = 'cartographer_card_style';
const topTagsKey = 'cartographer_top_tags_collapsed';
const namespacePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// NoteType preserves the legacy precedence of data, link, and text cards.
function NoteType(note: NoteData): 'Data' | 'Link' | 'Note' {
  return note.data && Object.keys(note.data).length ? 'Data' : note.url ? 'Link' : 'Note';
}

// MatchesSearch requires every entered term to appear in searchable note content.
function MatchesSearch(note: NoteData, search: string): boolean {
  const fields = [note.title, note.body, note.url, note.source, note.author, ...(note.tags || [])].join(' ').toLowerCase();
  return search.toLowerCase().split(/\s+/).filter(Boolean).every(term => fields.includes(term));
}

// NoteCard renders a note with actions, metadata, Markdown, data, and tags.
function NoteCard({ note, namespace, admin, onOpen, onDelete, onTag }: {
  note: NoteData; namespace: string; admin: boolean;
  onOpen: (note: NoteData) => void; onDelete: (note: NoteData) => void; onTag: (tag: string) => void;
}): React.JSX.Element {
  const type = NoteType(note);
  const color = GetColor('noteType', type);
  return <article className={`link-card note-card note-card--${type.toLowerCase()}`} style={color ? { borderColor: color } : undefined} onClick={() => onOpen(note)}>
    <div className="note-actions"><a href={NoteURL(note.id, namespace)} onClick={event => event.stopPropagation()}>Open</a>
      {admin && <><a href={NoteURL(note.id, namespace, true)} onClick={event => event.stopPropagation()}>Edit</a>
        <button type="button" onClick={event => { event.stopPropagation(); onDelete(note); }}>Delete</button></>}</div>
    <div className="card-view"><div className="note-card__content d-flex flex-column gap-2">
      <div className="note-meta-row"><span className="note-type-badge">{type}</span>
        {note.version ? <span className="note-meta-chip">v{note.version}</span> : null}
        {note.source ? <span className="note-meta-chip" style={GetColor('source', note.source) ? { borderColor: GetColor('source', note.source) || undefined } : undefined}>{note.source}</span> : null}
        {note.updated_at ? <span className="note-meta-chip">Updated {typeof note.updated_at === 'string' ? new Date(note.updated_at).toLocaleDateString() : new Date(Number(note.updated_at.seconds || 0) * 1000).toLocaleDateString()}</span> : null}</div>
      <h2 className="link-title note-title">{note.url ? <a href={note.url} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>{note.title}</a> : note.title}</h2>
      <div className="link-description note-markdown note-markdown--preview" dangerouslySetInnerHTML={{ __html: RenderMarkdown(note.body || '') }} />
      {note.data && Object.keys(note.data).length > 0 && <details className="data-container" onClick={event => event.stopPropagation()}><summary>Structured data</summary><pre>{JSON.stringify(note.data, null, 2)}</pre></details>}
      <div className="note-card__footer">{(note.tags || []).map(tag => <button className="nav-tag" type="button" key={tag} onClick={event => { event.stopPropagation(); onTag(tag); }}>{tag}</button>)}</div>
    </div></div>
  </article>;
}

// DesktopApp provides the React browsing preview until admin parity permits cutover.
export function DesktopApp(): React.JSX.Element {
  const [namespace, setNamespace] = useState(GetCurrentNamespace);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [search, setSearch] = useState(new URLSearchParams(location.search).getAll('term').join(' '));
  const [submittedSearch, setSubmittedSearch] = useState(new URLSearchParams(location.search).getAll('term').join(' '));
  const [tag, setTag] = useState<string | null>(new URLSearchParams(location.search).get('tag'));
  const [sort, setSort] = useState<NoteSortMode>(GetNoteSortMode);
  const [style, setStyle] = useState(localStorage.getItem(cardStyleKey) === 'condensed' ? 'condensed' : 'comfortable');
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState<NoteData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [finder, setFinder] = useState('');
  const [tagsCollapsed, setTagsCollapsed] = useState(localStorage.getItem(topTagsKey) === 'true');
  const [reloadKey, setReloadKey] = useState(0);
  const [colorVersion, setColorVersion] = useState(0);

  useEffect(() => {
    void GetNamespaces().then(setNamespaces).catch(() => setError('Unable to load namespaces.'));
    void GetAdminSession().then(session => setAdmin(session.admin)).catch(() => setAdmin(false));
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.getElementById('react-search')?.focus(); }
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    const onHistory = () => {
      const params = new URLSearchParams(location.search);
      const terms = params.getAll('term').join(' ');
      setNamespace(params.get('namespace') || GetCurrentNamespace());
      setSearch(terms);
      setSubmittedSearch(terms);
      setTag(params.get('tag'));
    };
    window.addEventListener('popstate', onHistory);
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('popstate', onHistory); };
  }, []);

  useEffect(() => {
    SetCurrentNamespace(namespace);
    const url = new URL(location.href);
    url.searchParams.set('namespace', namespace);
    history.replaceState(null, '', url);
    const filters = new URLSearchParams();
    if (tag) filters.append('tag', tag);
    submittedSearch.split(/\s+/).filter(Boolean).forEach(term => filters.append('term', term));
    filters.set('namespace', namespace);
    const path = `/v1/get?${filters}`;
    const cached = getCacheEntry(path);
    if (isCacheValid(cached)) setNotes(cached!.data.notes);
    setLoading(!isCacheValid(cached));
    setError('');
    let active = true;
    void GetNotes(namespace, filters).then(data => {
      if (!active) return;
      setNotes(data);
      setCacheEntry(path, { notes: data });
      setLoading(false);
    }).catch(() => { if (active) { setError('Unable to load notes.'); setLoading(false); } });
    return () => { active = false; };
  }, [namespace, submittedSearch, tag, reloadKey]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach(note => note.tags?.forEach(value => counts.set(value, (counts.get(value) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20);
  }, [notes]);
  const visible = useMemo(() => SortNotes(notes.filter(note => (!tag || note.tags?.includes(tag)) && MatchesSearch(note, search)), sort, Boolean(search.trim())), [notes, tag, search, sort]);

  // ChangeNamespace selects a collection and clears filters from the previous one.
  function ChangeNamespace(value: string): void {
    const url = new URL(location.href);
    url.searchParams.set('namespace', value);
    url.searchParams.delete('term');
    url.searchParams.delete('tag');
    history.pushState(null, '', url);
    setNamespace(value); setTag(null); setSearch(''); setSubmittedSearch('');
  }

  // SubmitSearch makes the current search shareable through the URL.
  function SubmitSearch(event: React.FormEvent): void {
    event.preventDefault();
    const url = new URL(location.href);
    url.searchParams.delete('term');
    search.trim().split(/\s+/).filter(Boolean).forEach(term => url.searchParams.append('term', term));
    history.pushState(null, '', url);
    setSubmittedSearch(search);
  }

  // ToggleTag applies a tag filter and synchronizes the URL.
  function ToggleTag(value: string): void {
    const next = tag === value ? null : value;
    setTag(next);
    const url = new URL(location.href);
    url.searchParams.delete('tag');
    if (next) url.searchParams.set('tag', next);
    history.pushState(null, '', url);
  }

  // DeleteNote uses the existing admin endpoint after confirmation.
  async function DeleteNote(note: NoteData): Promise<void> {
    if (!confirm(`Delete “${note.title}”?`)) return;
    try {
      await RequestJSON(`/v1/notes?id=${encodeURIComponent(note.id)}&namespace=${encodeURIComponent(namespace)}`, { method: 'DELETE' });
      invalidateCache();
      setNotes(current => current.filter(item => item.id !== note.id));
      setOpen(null);
    } catch { setError('Unable to delete note.'); }
  }

  return <div className={style === 'condensed' ? 'card-style-condensed' : ''} data-color-version={colorVersion}>
    <nav className="navbar top-nav py-3"><div className="container-fluid gap-3 align-items-center">
      <a className="navbar-brand brand" href="/react-preview"><i className="bi bi-compass" /> {document.getElementById('react-desktop-root')?.dataset.siteName || 'Cartographer'}</a>
      <form className="flex-grow-1" onSubmit={SubmitSearch}><input id="react-search" className="form-control search-input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search notes and tags..." aria-label="Search notes" /></form>
      {admin && <a className="btn nav-action" href={`/note?mode=create&namespace=${encodeURIComponent(namespace)}`}>Add note</a>}
      <AdminPanel notes={notes} onSessionChange={setAdmin} onNamespaceChange={() => {
        void GetNamespaces().then(values => { setNamespaces(values); if (!values.includes(namespace)) setNamespace('default'); });
        setReloadKey(value => value + 1);
      }} onColorChange={() => setColorVersion(value => value + 1)} />
      <a className="btn nav-action" href="/mobile?view=mobile">Mobile view</a>
    </div><div className="container-fluid nav-meta"><div className="nav-tags namespace-tabs">
      {[...new Set([...namespaces.slice(0, 16), namespace])].map(value => <button className={`nav-tag ${value === namespace ? 'active' : ''}`} key={value} type="button" style={GetColor('namespace', value) ? { borderColor: GetColor('namespace', value) || undefined } : undefined} onClick={() => ChangeNamespace(value)}>{value}</button>)}
      <input className="form-control" value={finder} onChange={event => setFinder(event.target.value)} placeholder="Find namespace" aria-label="Find namespace" list="react-namespace-list" />
      <datalist id="react-namespace-list">{namespaces.filter(value => value.toLowerCase().includes(finder.toLowerCase())).map(value => <option value={value} key={value} />)}</datalist>
      {finder && namespaces.includes(finder) && <button type="button" onClick={() => { ChangeNamespace(finder); setFinder(''); }}>Open {finder}</button>}
      {admin && finder && !namespaces.includes(finder) && namespacePattern.test(finder) && <a href={`/note?mode=create&namespace=${encodeURIComponent(finder)}`}>Create {finder}</a>}
    </div><div className="nav-tags"><button type="button" className="nav-tag" onClick={() => { const next = !tagsCollapsed; setTagsCollapsed(next); localStorage.setItem(topTagsKey, String(next)); }} aria-expanded={!tagsCollapsed}>Tags {tagsCollapsed ? 'Show' : 'Hide'}</button>
      {!tagsCollapsed && tags.map(([value, count]) => <button type="button" className={`nav-tag ${value === tag ? 'active' : ''}`} key={value} onClick={() => ToggleTag(value)}>{value} {count}</button>)}</div></div></nav>
    <main className="container-fluid py-4"><div className="d-flex align-items-center justify-content-between gap-3 mb-3"><span>{loading ? 'Loading notes…' : `${visible.length} notes`}</span><div className="d-flex gap-2">
      <select className="form-select" value={sort} aria-label="Sort notes" onChange={event => { const value = event.target.value as NoteSortMode; setSort(value); SetNoteSortMode(value); }}><option value="smart">Smart</option><option value="title-asc">Title A–Z</option><option value="title-desc">Title Z–A</option></select>
      <select className="form-select" value={style} aria-label="Card style" onChange={event => { setStyle(event.target.value); localStorage.setItem(cardStyleKey, event.target.value); }}><option value="comfortable">Comfortable</option><option value="condensed">Condensed</option></select>
    </div></div>{error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!loading && visible.length === 0 && <p>No notes found.</p>}
      <div id="linkgrid">{visible.slice(0, 100).map(note => <NoteCard key={note.id} note={note} namespace={namespace} admin={admin} onOpen={setOpen} onDelete={note => void DeleteNote(note)} onTag={ToggleTag} />)}</div>
      {visible.length > 100 && <p>Showing the first 100 notes. Refine your search to see more.</p>}
    </main>
    {open && <div id="maximized-card-overlay" role="presentation" onClick={() => setOpen(null)}><article className="link-card note-card" role="dialog" aria-modal="true" aria-label={open.title} onClick={event => event.stopPropagation()}>
      <button type="button" className="btn btn-outline-secondary" onClick={() => setOpen(null)}>Close</button><h2>{open.title}</h2>
      <div className="note-markdown" dangerouslySetInnerHTML={{ __html: RenderMarkdown(open.body || '') }} />
      {open.data && <pre>{JSON.stringify(open.data, null, 2)}</pre>}<a href={NoteURL(open.id, namespace)}>Open note</a>
    </article></div>}
  </div>;
}

// MountDesktopApp mounts the React preview when its shell is served.
export function MountDesktopApp(): void {
  const element = document.getElementById('react-desktop-root');
  if (element) createRoot(element).render(<DesktopApp />);
}

MountDesktopApp();
