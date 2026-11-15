import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Box, Button, Card, Chip, Drawer, IconButton, Input, Option, Select, Sheet, Stack, Tab, TabList, Tabs, Typography } from '@mui/joy';
import type { NoteData } from '../shared/types.js';
import { CountMobileTags, FormatMobileTimestamp, GetMobileNoteType, MatchesMobileSearch } from '../mobile/model.js';
import { GetNoteSortMode, SetNoteSortMode, SortNotes, type NoteSortMode } from '../preferences/noteSort.js';
import { RenderMarkdown } from '../shared/markdown.js';
import { GetAdminSession, GetNamespaces, GetNotes } from './api.js';
import { GetCurrentNamespace, SetCurrentNamespace } from './navigation.js';
import { DiagramIndicator } from './DiagramIndicator.js';
import { GetDiagramScene } from './diagram.js';
import { JoyShell } from './JoyShell.js';

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

  const siteName = document.getElementById('react-mobile-root')?.dataset.siteName || 'Cartographer';
  const accentByType: Record<string, string> = { Note: '#6558d9', Link: '#1688be', Data: '#138a72', Diagram: '#8b5cf6' };
  return <JoyShell><Box className="joy-mobile">
    <Sheet component="header" className="joy-mobile-header" sx={{ bgcolor: '#111827', color: '#fff', px: 1.5, pt: 1.5, pb: 0.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}><Typography component="a" href="/mobile" level="title-lg" sx={{ color: '#fff', fontFamily: 'display', textDecoration: 'none', flex: 1 }}><i className="bi bi-compass" /> {siteName}</Typography><IconButton variant="soft" color="neutral" aria-label="Open filters" aria-expanded={sheet} onClick={() => setSheet(true)}><i className="bi bi-sliders2" /></IconButton></Stack>
      <Box component="form" role="search" onSubmit={SubmitSearch} sx={{ mt: 1 }}><Input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a note" aria-label="Find a note" startDecorator={<i className="bi bi-search" />} endDecorator={search && <IconButton size="sm" variant="plain" aria-label="Clear search" onClick={ClearSearch}><i className="bi bi-x-circle" /></IconButton>} sx={{ bgcolor: 'background.surface' }} /></Box>
      <Tabs value={namespace} onChange={(_, value) => { if (typeof value === 'string') SelectNamespace(value); }} sx={{ bgcolor: 'transparent', mt: 1 }}><TabList disableUnderline sx={{ overflowX: 'auto', gap: 0.25, borderBottom: '1px solid #475569' }}>{[...new Set([...namespaces, namespace])].sort().map(value => <Tab key={value} value={value} sx={{ flex: '0 0 auto', color: value === namespace ? '#fff' : '#cbd5e1', borderBottom: value === namespace ? '3px solid #67d6ff' : '3px solid transparent', borderRadius: '6px 6px 0 0', fontWeight: value === namespace ? 700 : 500 }}>{value}</Tab>)}</TabList></Tabs>
    </Sheet>
    <Box component="main" sx={{ maxWidth: 760, mx: 'auto', px: 1.5, py: 2, pb: 10 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}><Box sx={{ flex: 1 }}><Typography level="title-md">{loading ? 'Loading notes…' : `${visible.length} notes`}</Typography><Typography level="body-xs">in {namespace}</Typography></Box><Button size="sm" variant="outlined" color="neutral" startDecorator={<i className="bi bi-funnel" />} onClick={() => setSheet(true)}>Filter</Button></Stack>
      {(selectedTags.length > 0 || filters.has('term')) && <Stack direction="row" spacing={0.5} sx={{ overflowX: 'auto', mb: 1.5 }}>{[...selectedTags.map(value => ({ kind: 'tag', value })), ...filters.getAll('term').map(value => ({ kind: 'term', value }))].map(({ kind, value }) => <Button key={`${kind}:${value}`} size="sm" variant="soft" sx={{ borderRadius: 'sm', flex: '0 0 auto' }} onClick={() => { if (kind === 'tag') ToggleTag(value); else { const next = new URLSearchParams(filters); const values = next.getAll('term').filter(item => item !== value); next.delete('term'); values.forEach(item => next.append('term', item)); setSearch(values.join(' ')); UpdateURL(next); } }}>{value} <i className="bi bi-x" /></Button>)}</Stack>}
      <Stack component="section" aria-label="Notes" aria-busy={loading} spacing={1.25}>{error && <Alert color="danger">{error}</Alert>}{!loading && !error && visible.length === 0 && <Sheet variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 'md' }}><Typography level="title-md">No notes found</Typography><Typography level="body-sm">Try another search, tag, or namespace.</Typography></Sheet>}
        {visible.map(note => { const type = GetMobileNoteType(note); const stamp = FormatMobileTimestamp(note.updated_at || note.created_at); const accent = accentByType[type.label] || '#6558d9'; const scene = GetDiagramScene(note); return <Card key={note.id} component="article" variant="outlined" tabIndex={0} role="link" aria-label={`Open ${note.title}`} onClick={() => location.assign(NotePath(note))} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) location.assign(NotePath(note)); }} sx={{ cursor: 'pointer', borderLeft: `4px solid ${accent}`, boxShadow: 'sm', '&:hover': { boxShadow: 'md' } }}>
          <Stack direction="row" spacing={0.75} alignItems="center"><Chip size="sm" variant="soft" sx={{ borderRadius: 'sm', bgcolor: `${accent}20`, color: accent }}><i className={type.icon} /> {type.label}</Chip>{stamp && <Typography level="body-xs" sx={{ ml: 'auto !important' }}>{stamp}</Typography>}{note.source && <Typography level="body-xs">{note.source}</Typography>}</Stack>
          <Typography level="title-lg" sx={{ overflowWrap: 'anywhere' }}>{note.title || note.url || note.id}</Typography>
          {scene ? <DiagramIndicator /> : <Box className="joy-markdown joy-mobile-preview" dangerouslySetInnerHTML={{ __html: RenderMarkdown(note.body || note.url || '') }} />}
          <Stack direction="row" spacing={0.5} alignItems="center">{(note.tags || []).slice(0, 3).map(value => <Button size="sm" variant="soft" color="neutral" key={value} onClick={event => { event.stopPropagation(); ToggleTag(value); }} sx={{ borderRadius: 'sm', bgcolor: 'background.level1', color: 'text.primary', '&:hover': { bgcolor: 'background.level2' } }}>{value}</Button>)}{(note.tags || []).length > 3 && <Typography level="body-xs">+{note.tags.length - 3}</Typography>}<i className="bi bi-chevron-right" style={{ marginLeft: 'auto' }} /></Stack>
        </Card>; })}</Stack>
    </Box>
    {admin && <Button component="a" href={NotePath(null)} aria-label="Add note" className="joy-mobile-add" sx={{ position: 'fixed', right: 20, bottom: 20, zIndex: 10, borderRadius: '50%', width: 56, height: 56, boxShadow: 'lg' }}><i className="bi bi-plus-lg" /></Button>}
    <Drawer open={sheet} anchor="bottom" onClose={() => setSheet(false)} sx={{ '--Drawer-verticalSize': 'min(70vh, 620px)' }}><Sheet sx={{ height: '100%', overflowY: 'auto', p: 2 }}><Stack direction="row" alignItems="center"><Typography level="h2" sx={{ flex: 1 }}>Filter notes</Typography><IconButton variant="plain" aria-label="Close filters" onClick={() => setSheet(false)}><i className="bi bi-x-lg" /></IconButton></Stack>
      <Typography level="title-sm" sx={{ mt: 2, mb: 0.5 }}>Order</Typography><Select slotProps={{ listbox: { disablePortal: true } }} value={sort} onChange={(_, value) => { if (value) { setSort(value); SetNoteSortMode(value); } }}><Option value="smart">Smart</Option><Option value="title-asc">Title A–Z</Option><Option value="title-desc">Title Z–A</Option></Select>
      <Typography level="title-sm" sx={{ mt: 2, mb: 1 }}>Tags</Typography><Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>{tags.map(([value, count]) => <Button key={value} size="sm" variant={selectedTags.includes(value) ? 'solid' : 'soft'} color={selectedTags.includes(value) ? 'primary' : 'neutral'} onClick={() => ToggleTag(value)} sx={{ borderRadius: 'sm' }}>{value} <Typography level="body-xs" sx={{ ml: 0.5, color: 'inherit' }}>{count}</Typography></Button>)}</Stack>
      <Button component="a" href="/?view=desktop" variant="outlined" color="neutral" startDecorator={<i className="bi bi-display" />} onClick={() => localStorage.setItem('cartographer_view_preference', 'desktop')} sx={{ mt: 3, width: '100%' }}>Desktop site</Button>
    </Sheet></Drawer>
  </Box></JoyShell>;
}

// MountMobileApp mounts the separate React phone experience.
export function MountMobileApp(): void {
  const root = document.getElementById('react-mobile-root');
  if (root) createRoot(root).render(<MobileApp />);
}

MountMobileApp();
