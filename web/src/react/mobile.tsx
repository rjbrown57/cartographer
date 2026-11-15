import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { NoteData } from '../shared/types.js';
import { CountMobileTags, FormatMobileTimestamp, GetMobileNoteType, MatchesMobileSearch } from '../mobile/model.js';
import { GetNoteSortMode, SetNoteSortMode, SortNotes, type NoteSortMode } from '../preferences/noteSort.js';
import { RenderMarkdown } from '../shared/markdown.js';
import { GetAdminSession, GetNamespaces, GetNotes } from './api.js';
import { GetCurrentNamespace, SetCurrentNamespace } from './navigation.js';

// MobileApp provides the distinct phone feed through React.
export function MobileApp(): React.JSX.Element {
  const [namespace, setNamespace] = useState(GetCurrentNamespace);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [search, setSearch] = useState(new URLSearchParams(location.search).getAll('term').join(' '));
  const [filters, setFilters] = useState(() => new URLSearchParams(location.search));
  const [sort, setSort] = useState<NoteSortMode>(GetNoteSortMode);
  const [sheet, setSheet] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('view');
    if (requested === 'mobile') {
      localStorage.setItem('cartographer_view_preference', 'mobile');
      const url = new URL(location.href); url.searchParams.delete('view'); history.replaceState(null, '', url);
    }
    void GetNamespaces().then(setNamespaces).catch(() => setError('Unable to load namespaces.'));
    void GetAdminSession().then(value => setAdmin(value.admin)).catch(() => setAdmin(false));
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSheet(false); };
    const onHistory = () => { const next = new URLSearchParams(location.search); setNamespace(next.get('namespace') || GetCurrentNamespace()); setSearch(next.getAll('term').join(' ')); setFilters(next); };
    document.addEventListener('keydown', onKey); window.addEventListener('popstate', onHistory);
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('popstate', onHistory); };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); SetCurrentNamespace(namespace);
    void GetNotes(namespace, filters).then(value => { if (active) { setNotes(value); setLoading(false); } }).catch(() => { if (active) { setError('Unable to load notes.'); setLoading(false); } });
    return () => { active = false; };
  }, [namespace, filters]);

  const selectedTags = filters.getAll('tag');
  const visible = useMemo(() => SortNotes(notes.filter(note => MatchesMobileSearch(note, search)), sort, filters.has('term')), [notes, search, sort, filters]);
  const tags = useMemo(() => CountMobileTags(notes).slice(0, 24), [notes]);

  // UpdateURL stores namespace and filter state in browser history.
  function UpdateURL(next: URLSearchParams): void {
    const url = new URL(location.href); url.search = next.toString(); history.pushState(null, '', url); setFilters(next);
  }

  // SelectNamespace changes the feed and preserves the mobile route.
  function SelectNamespace(value: string): void {
    const next = new URLSearchParams(filters); next.set('namespace', value); UpdateURL(next); setNamespace(value);
  }

  // ToggleTag applies or removes one backend tag filter.
  function ToggleTag(value: string): void {
    const next = new URLSearchParams(filters); const values = next.getAll('tag'); next.delete('tag');
    (values.includes(value) ? values.filter(item => item !== value) : [...values, value]).forEach(item => next.append('tag', item)); UpdateURL(next);
  }

  // SubmitSearch sends entered terms to the backend while keeping local filtering immediate.
  function SubmitSearch(event: React.FormEvent): void {
    event.preventDefault(); const next = new URLSearchParams(filters); next.delete('term');
    search.split(/\s+/).filter(Boolean).forEach(term => next.append('term', term)); UpdateURL(next);
  }

  // ClearSearch clears typed and URL search terms.
  function ClearSearch(): void { setSearch(''); const next = new URLSearchParams(filters); next.delete('term'); UpdateURL(next); }

  // NotePath preserves the current mobile feed as the return destination.
  function NotePath(note: NoteData | null): string {
    const query = new URLSearchParams({ namespace, returnTo: `${location.pathname}${location.search}${location.hash}` });
    if (note) query.set('id', note.id); else query.set('mode', 'create');
    return `/note?${query}`;
  }

  return <>
    <header className="mobile-header"><div className="mobile-topbar"><a className="mobile-brand" href="/mobile"><i className="bi bi-compass" /><span>{document.getElementById('react-mobile-root')?.dataset.siteName || 'Cartographer'}</span></a>
      <button className="mobile-icon-button" type="button" aria-label="Open filters" aria-expanded={sheet} onClick={() => setSheet(true)}><i className="bi bi-sliders2" /></button></div>
      <form className="mobile-search" role="search" onSubmit={SubmitSearch}><i className="bi bi-search" aria-hidden="true" /><input type="search" enterKeyHint="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a note" aria-label="Find a note" />
        {search && <button className="mobile-search__clear is-visible" type="button" onClick={ClearSearch} aria-label="Clear search"><i className="bi bi-x-circle-fill" /></button>}</form>
      <nav className="mobile-namespaces" aria-label="Namespaces">{[...new Set([...namespaces, namespace])].sort().map(value => <button type="button" key={value} aria-pressed={namespace === value} onClick={() => SelectNamespace(value)}>{value}</button>)}</nav>
    </header>
    <main className="mobile-main"><section className="mobile-feed-heading" aria-live="polite"><div><strong>{loading ? 'Loading notes' : `${visible.length} notes`}</strong><span>{namespace}</span></div><button className="mobile-feed-heading__filter" type="button" onClick={() => setSheet(true)}><i className="bi bi-funnel" /><span>Filter</span></button></section>
      <div className={`mobile-active-filters ${selectedTags.length || filters.has('term') ? '' : 'is-empty'}`}>{[...selectedTags.map(value => ({ kind: 'tag', value })), ...filters.getAll('term').map(value => ({ kind: 'term', value }))].map(({ kind, value }) => <button className="mobile-active-filter" type="button" key={`${kind}:${value}`} onClick={() => { if (kind === 'tag') ToggleTag(value); else { const next = new URLSearchParams(filters); const values = next.getAll('term').filter(item => item !== value); next.delete('term'); values.forEach(item => next.append('term', item)); setSearch(values.join(' ')); UpdateURL(next); } }}>{value} <i className="bi bi-x" /></button>)}</div>
      <section className="mobile-feed" aria-label="Notes" aria-busy={loading}>{error && <div className="mobile-empty mobile-empty--error">{error}</div>}{!loading && !error && visible.length === 0 && <div className="mobile-empty"><strong>No notes found</strong><span>Try another search, tag, or namespace.</span></div>}
        {visible.map(note => { const type = GetMobileNoteType(note); const stamp = FormatMobileTimestamp(note.updated_at || note.created_at); return <article className={`mobile-note ${type.className}`} role="link" tabIndex={0} aria-label={`Open ${note.title}`} key={note.id} onClick={() => location.assign(NotePath(note))} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') location.assign(NotePath(note)); }}>
          <div className="mobile-note__meta"><span className="mobile-note__type"><i className={type.icon} />{type.label}</span>{stamp && <span className="mobile-note__date">{stamp}</span>}{note.source && <span className="mobile-note__source">{note.source}</span>}</div>
          <h2 className="mobile-note__title">{note.title || note.url || note.id}</h2><div className="mobile-note__preview" dangerouslySetInnerHTML={{ __html: RenderMarkdown(note.body || note.url || '') }} />
          <div className="mobile-note__footer"><div className="mobile-note__tags">{(note.tags || []).slice(0, 3).map(value => <button className="mobile-note__tag" type="button" key={value} onClick={event => { event.stopPropagation(); ToggleTag(value); }}>{value}</button>)}{(note.tags || []).length > 3 && <span className="mobile-note__more">+{note.tags.length - 3}</span>}</div><span className="mobile-note__open"><i className="bi bi-chevron-right" /></span></div>
        </article>; })}</section></main>
    {admin && <a className="mobile-add-note is-visible" href={NotePath(null)} aria-label="Add note"><i className="bi bi-plus-lg" /></a>}
    <section className={`mobile-filter-sheet ${sheet ? 'is-open' : ''}`} aria-hidden={!sheet} inert={!sheet}><button className="mobile-filter-sheet__backdrop" type="button" aria-label="Close filters" onClick={() => setSheet(false)} /><div className="mobile-filter-sheet__panel" role="dialog" aria-modal="true" aria-label="Filter notes">
      <div className="mobile-filter-sheet__handle" /><header className="mobile-filter-sheet__header"><div><span className="mobile-eyebrow">Browse</span><h2>Filter notes</h2></div><button className="mobile-icon-button mobile-icon-button--light" type="button" onClick={() => setSheet(false)} aria-label="Close filters"><i className="bi bi-x-lg" /></button></header>
      <label className="mobile-field"><span>Order</span><select value={sort} onChange={event => { const value = event.target.value as NoteSortMode; setSort(value); SetNoteSortMode(value); }}><option value="smart">Smart</option><option value="title-asc">Title A–Z</option><option value="title-desc">Title Z–A</option></select></label>
      <div className="mobile-filter-section"><h3>Tags</h3><div className="mobile-filter-tags">{tags.map(([value, count]) => <button type="button" className={`mobile-filter-tag ${selectedTags.includes(value) ? 'is-active' : ''}`} aria-pressed={selectedTags.includes(value)} key={value} onClick={() => ToggleTag(value)}><span>{value}</span><small>{count}</small></button>)}</div></div>
      <a className="mobile-desktop-link" href="/?view=desktop" onClick={() => localStorage.setItem('cartographer_view_preference', 'desktop')}><i className="bi bi-display" /><span><strong>Desktop site</strong><small>Open the full card workspace and admin tools</small></span><i className="bi bi-chevron-right" /></a>
    </div></section>
  </>;
}

// MountMobileApp mounts the separate React phone experience.
export function MountMobileApp(): void {
  const root = document.getElementById('react-mobile-root');
  if (root) createRoot(root).render(<MobileApp />);
}

MountMobileApp();
