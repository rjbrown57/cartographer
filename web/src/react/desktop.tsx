import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Autocomplete, Box, Button, Card, Chip, IconButton, Input, Modal, ModalDialog, Sheet, Stack, Tab, TabList, Tabs, Tooltip, Typography } from '@mui/joy';
import type { NoteData } from '../shared/types.js';
import { getCacheEntry, invalidateCache, isCacheValid, setCacheEntry } from '../components/cache.js';
import { GetColor } from '../preferences/colors.js';
import { GetNoteSortMode, SortNotes, type NoteSortMode } from '../preferences/noteSort.js';
import { RenderMarkdown } from '../shared/markdown.js';
import { GetAdminSession, GetNamespaces, GetNotes, RequestJSON } from './api.js';
import { GetCurrentNamespace, NoteURL, SetCurrentNamespace } from './navigation.js';
import { AdminPanel } from './AdminPanel.js';
import { DiagramIndicator } from './DiagramIndicator.js';
import { GetDiagramScene } from './diagram.js';
import { JoyShell } from './JoyShell.js';

const cardStyleKey = 'cartographer_card_style';
const topTagsKey = 'cartographer_top_tags_collapsed';
const namespacePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const typeColors = { Note: '#6558d9', Link: '#1688be', Data: '#138a72', Diagram: '#8b5cf6' };
const tagButtonSx = { borderRadius: '999px', bgcolor: '#e2e8f0', color: '#1e293b', fontSize: '0.72rem', minHeight: 24, px: 1, '&:hover': { bgcolor: '#cbd5f5' } };

// NoteType preserves the legacy precedence of data, link, and text cards.
function NoteType(note: NoteData): keyof typeof typeColors {
  if (note.data?.kind === 'diagram' && note.data?.version === 1) return 'Diagram';
  return note.data && Object.keys(note.data).length ? 'Data' : note.url ? 'Link' : 'Note';
}

// MatchesSearch requires every entered term to appear in searchable note content.
function MatchesSearch(note: NoteData, search: string): boolean {
  const fields = [note.title, note.body, note.url, note.source, note.author, ...(note.tags || [])].join(' ').toLowerCase();
  return search.toLowerCase().split(/\s+/).filter(Boolean).every(term => fields.includes(term));
}

// NoteDate formats either API timestamp representation for compact cards.
function NoteDate(note: NoteData): string {
  const stamp = note.updated_at || note.created_at;
  if (!stamp) return '';
  const date = typeof stamp === 'string' ? new Date(stamp) : new Date(Number(stamp.seconds || 0) * 1000);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

// NoteCard renders one consistently sized Joy card with the original note metadata.
function NoteCard({ note, namespace, admin, condensed, onOpen, onDelete, onTag }: {
  note: NoteData; namespace: string; admin: boolean; condensed: boolean;
  onOpen: (note: NoteData) => void; onDelete: (note: NoteData) => void; onTag: (tag: string) => void;
}): React.JSX.Element {
  const type = NoteType(note);
  const accent = GetColor('noteType', type) || typeColors[type];
  const scene = GetDiagramScene(note);
  const [copied, setCopied] = useState<'body' | 'link' | null>(null);

  // CopyToClipboard preserves the compact copy actions from the original cards.
  async function CopyToClipboard(value: string, kind: 'body' | 'link'): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement('textarea');
      input.value = value; document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
    }
    setCopied(kind); window.setTimeout(() => setCopied(null), 1600);
  }

  return <Card component="article" variant="outlined" tabIndex={0} onClick={() => onOpen(note)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(note); } }}
    sx={{ height: condensed ? 144 : 232, minWidth: 0, overflow: 'hidden', cursor: 'pointer', borderColor: '#cbd5e1', borderLeft: `4px solid ${accent}`, boxShadow: 'sm', p: condensed ? 1.25 : 1.5, gap: 0.6, '&:hover': { boxShadow: 'md', borderColor: '#94a3b8', transform: 'translateY(-2px)' }, '&:focus-visible': { outline: `3px solid ${accent}`, outlineOffset: 2 } }}>
    <Stack direction="row" alignItems="flex-start" spacing={0.5} sx={{ minHeight: 28 }}>
      <Stack direction="row" spacing={0.4} alignItems="center" sx={{ flex: 1, flexWrap: 'wrap', pr: 0.5 }}>
        <Chip size="sm" variant="soft" sx={{ borderRadius: '999px', bgcolor: `${accent}20`, color: accent, fontWeight: 700, fontSize: '0.7rem', minHeight: 20 }}>{type}</Chip>
        {(note.tags || []).length > 0 && <Chip size="sm" variant="soft" color="neutral" sx={{ borderRadius: '999px', minHeight: 20, fontSize: '0.68rem' }}><i className="bi bi-tags" /> {note.tags.length}</Chip>}
        {note.version ? <Chip size="sm" variant="soft" color="neutral" sx={{ borderRadius: '999px', minHeight: 20, fontSize: '0.68rem' }}>v{note.version}</Chip> : null}
      </Stack>
      <Stack direction="row" spacing={0} className="joy-card-actions">
        <IconButton size="sm" variant="plain" color="neutral" title="Copy note link" aria-label={`Copy link to ${note.title}`} onClick={event => { event.stopPropagation(); void CopyToClipboard(new URL(NoteURL(note.id, namespace), location.origin).toString(), 'link'); }}><i className={`bi bi-${copied === 'link' ? 'check2' : 'link-45deg'}`} /></IconButton>
        {admin && <><IconButton component="a" href={NoteURL(note.id, namespace, true)} size="sm" variant="plain" color="neutral" title="Edit note" aria-label={`Edit ${note.title}`} onClick={event => event.stopPropagation()}><i className="bi bi-pencil" /></IconButton><IconButton size="sm" variant="plain" color="danger" title="Delete note" aria-label={`Delete ${note.title}`} onClick={event => { event.stopPropagation(); onDelete(note); }}><i className="bi bi-trash" /></IconButton></>}
      </Stack>
    </Stack>
    <Typography level="title-md" className="joy-card-title" sx={{ color: 'text.primary', fontWeight: 700, fontSize: '1rem' }}>{note.title || note.url || note.id}</Typography>
    {!condensed && <Box className="joy-card-content">
      {note.body && <Box className="joy-markdown joy-card-markdown" dangerouslySetInnerHTML={{ __html: RenderMarkdown(note.body) }} />}
      {scene ? <DiagramIndicator /> : note.data && Object.keys(note.data).length > 0 && !note.body ? <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Structured data</Typography> : null}
      {!note.body && !scene && !note.data && note.url && <Typography component="a" href={note.url} target="_blank" rel="noopener noreferrer" level="body-sm" onClick={event => event.stopPropagation()} sx={{ overflowWrap: 'anywhere' }}>{note.url}</Typography>}
    </Box>}
    <Stack direction="row" alignItems="center" spacing={0.5} className="joy-card-footer" sx={{ mt: 'auto', minHeight: 30, overflow: 'hidden', borderTop: '1px solid #dbe3ef', pt: 0.75 }}>
      <i className="bi bi-tags" style={{ fontSize: '0.75rem', color: '#94a3b8' }} />
      {(note.tags || []).slice(0, condensed ? 2 : 3).map(tag => <Button key={tag} className="joy-card-tag" size="sm" variant="soft" color="neutral" sx={{ ...tagButtonSx, minWidth: 0, maxWidth: 115, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={event => { event.stopPropagation(); onTag(tag); }}>{tag}</Button>)}
      {(note.tags || []).length > (condensed ? 2 : 3) && <Typography level="body-xs">+{note.tags.length - (condensed ? 2 : 3)}</Typography>}
    </Stack>
  </Card>;
}

// DesktopApp provides namespace browsing, search, cards, and admin access.
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
  const namespaceTabsRef = useRef<HTMLDivElement>(null);
  const [namespaceOverflow, setNamespaceOverflow] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useState(localStorage.getItem(topTagsKey) === 'true');
  const [reloadKey, setReloadKey] = useState(0);
  const [colorVersion, setColorVersion] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(100);

  useEffect(() => {
    const container = namespaceTabsRef.current;
    if (!container) return;
    // Keep the finder available when tabs cannot fit in the header.
    const measure = () => {
      const list = container.querySelector('[role="tablist"]');
      setNamespaceOverflow(Boolean(list && list.scrollWidth > list.clientWidth + 2));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    measure();
    return () => observer.disconnect();
  }, [namespaces]);

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
      setSearch(terms); setSubmittedSearch(terms); setTag(params.get('tag'));
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
    setLoading(!isCacheValid(cached)); setError('');
    let active = true;
    void GetNotes(namespace, filters).then(data => {
      if (!active) return;
      setNotes(data); setCacheEntry(path, { notes: data }); setLoading(false);
    }).catch(() => { if (active) { setError('Unable to load notes.'); setLoading(false); } });
    return () => { active = false; };
  }, [namespace, submittedSearch, tag, reloadKey]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach(note => note.tags?.forEach(value => counts.set(value, (counts.get(value) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 30);
  }, [notes]);
  const visible = useMemo(() => SortNotes(notes.filter(note => (!tag || note.tags?.includes(tag)) && MatchesSearch(note, search)), sort, Boolean(search.trim())), [notes, tag, search, sort]);
  useEffect(() => { setVisibleLimit(100); }, [namespace, submittedSearch, tag, search, sort]);

  // ChangeNamespace selects a collection and clears filters from the previous one.
  function ChangeNamespace(value: string): void {
    const url = new URL(location.href);
    url.searchParams.set('namespace', value); url.searchParams.delete('term'); url.searchParams.delete('tag');
    history.pushState(null, '', url);
    setNamespace(value); setTag(null); setSearch(''); setSubmittedSearch('');
  }

  // SubmitSearch makes the current search shareable through the URL.
  function SubmitSearch(event: React.FormEvent): void {
    event.preventDefault();
    const url = new URL(location.href);
    url.searchParams.delete('term');
    search.trim().split(/\s+/).filter(Boolean).forEach(term => url.searchParams.append('term', term));
    history.pushState(null, '', url); setSubmittedSearch(search);
  }

  // ToggleTag applies a tag filter and synchronizes the URL.
  function ToggleTag(value: string): void {
    const next = tag === value ? null : value;
    setTag(next);
    const url = new URL(location.href);
    url.searchParams.delete('tag'); if (next) url.searchParams.set('tag', next);
    history.pushState(null, '', url);
  }

  // DeleteNote uses the existing admin endpoint after confirmation.
  async function DeleteNote(note: NoteData): Promise<void> {
    if (!confirm(`Delete “${note.title}”?`)) return;
    try {
      await RequestJSON(`/v1/notes?id=${encodeURIComponent(note.id)}&namespace=${encodeURIComponent(namespace)}`, { method: 'DELETE' });
      invalidateCache(); setNotes(current => current.filter(item => item.id !== note.id)); setOpen(null);
    } catch { setError('Unable to delete note.'); }
  }

  const siteName = document.getElementById('react-desktop-root')?.dataset.siteName || 'Cartographer';
  return <JoyShell><Box className="joy-desktop" data-color-version={colorVersion}>
    <Sheet component="header" className="joy-desktop-header" sx={{ bgcolor: '#0f172a', color: '#f8fafc' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={1.5} sx={{ px: { xs: 2, md: 3 }, py: 1.5 }}>
        <Typography component="a" href="/" level="h3" sx={{ color: '#fff', textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: 'display' }}><i className="bi bi-compass" /> {siteName}</Typography>
        <Box component="form" onSubmit={SubmitSearch} sx={{ flex: 1 }}><Input id="react-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search notes and tags…" aria-label="Search notes" startDecorator={<i className="bi bi-search" />} endDecorator={<Typography level="body-xs" sx={{ whiteSpace: 'nowrap' }}>⌘ K</Typography>} sx={{ width: '100%' }} /></Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {admin && <Tooltip title="Add note"><IconButton component="a" href={`/note?mode=create&namespace=${encodeURIComponent(namespace)}`} variant="outlined" className="joy-header-action" aria-label="Add note"><i className="bi bi-plus-lg" /></IconButton></Tooltip>}
          <AdminPanel notes={notes} noteCount={visible.length} cardStyle={style} onCardStyleChange={value => { setStyle(value); localStorage.setItem(cardStyleKey, value); }} onSortChange={setSort} onSessionChange={setAdmin} onNamespaceChange={() => {
            void GetNamespaces().then(values => { setNamespaces(values); if (!values.includes(namespace)) setNamespace('default'); });
            setReloadKey(value => value + 1);
          }} onColorChange={() => setColorVersion(value => value + 1)} />
          <Tooltip title="Swagger Docs"><IconButton component="a" href="/docs/index.html" target="_blank" rel="noopener noreferrer" variant="outlined" className="joy-header-action" aria-label="Swagger Docs"><i className="bi bi-braces-asterisk" /></IconButton></Tooltip>
          <Tooltip title="GitHub"><IconButton component="a" href="https://github.com/rjbrown57/cartographer" target="_blank" rel="noopener noreferrer" variant="outlined" className="joy-header-action" aria-label="GitHub"><i className="bi bi-github" /></IconButton></Tooltip>
        </Stack>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={1} sx={{ px: { xs: 2, md: 3 } }}>
        <Box ref={namespaceTabsRef} sx={{ flex: 1, minWidth: 0 }}>
          <Tabs value={namespace} onChange={(_, value) => { if (typeof value === 'string') ChangeNamespace(value); }} sx={{ bgcolor: 'transparent' }}>
            <TabList disableUnderline sx={{ overflowX: 'auto', gap: 0.5, borderBottom: '1px solid #475569' }}>
              {[...new Set([...namespaces.slice(0, 16), namespace])].map(value => <Tab key={value} value={value} variant="plain" sx={{ flex: '0 0 auto', borderRadius: '8px 8px 0 0', borderTop: value === namespace ? `3px solid ${GetColor('namespace', value) || '#22d3ee'}` : '3px solid transparent', px: 2, fontWeight: value === namespace ? 700 : 500, color: value === namespace ? '#0f172a' : '#cbd5e1', bgcolor: value === namespace ? '#f8fafc' : 'transparent', '&:hover': { bgcolor: value === namespace ? '#f8fafc' : '#334155', color: value === namespace ? '#0f172a' : '#fff' } }}>{value}</Tab>)}
            </TabList>
          </Tabs>
        </Box>
        {(namespaces.length > 16 || namespaceOverflow) && <Stack direction="row" spacing={0.5} sx={{ minWidth: { md: 230 } }}>
          <Autocomplete freeSolo size="sm" options={namespaces} inputValue={finder} onInputChange={(_, value) => setFinder(value)} onChange={(_, value) => { if (typeof value === 'string' && namespaces.includes(value)) { ChangeNamespace(value); setFinder(''); } }} placeholder="Find namespace" sx={{ flex: 1 }} />
          {admin && finder && !namespaces.includes(finder) && namespacePattern.test(finder) && <Button component="a" href={`/note?mode=create&namespace=${encodeURIComponent(finder)}`} size="sm">Create</Button>}
        </Stack>}
      </Stack>
      <Stack direction="row" alignItems="flex-start" spacing={0.75} sx={{ px: { xs: 2, md: 3 }, py: 1.25 }}>
        <Typography level="body-xs" sx={{ flex: '0 0 auto', color: '#94a3b8', letterSpacing: '0.1em', fontWeight: 700, pt: 0.5 }}>TOP TAGS</Typography>
        <IconButton size="sm" variant="outlined" aria-label={tagsCollapsed ? 'Show top tags' : 'Hide top tags'} onClick={() => { const next = !tagsCollapsed; setTagsCollapsed(next); localStorage.setItem(topTagsKey, String(next)); }} aria-expanded={!tagsCollapsed} sx={{ minWidth: 22, minHeight: 22, borderRadius: '50%', color: '#cbd5e1', borderColor: '#475569', '&:hover': { bgcolor: '#334155' } }}><i className={`bi bi-chevron-${tagsCollapsed ? 'down' : 'up'}`} /></IconButton>
        {!tagsCollapsed && <Box className="joy-top-tags">
          {tags.length ? tags.map(([value, count]) => <Button key={value} size="sm" variant="outlined" onClick={() => ToggleTag(value)} sx={{ borderRadius: '999px', minHeight: 22, px: 1, py: 0, fontSize: '0.7rem', fontWeight: 600, color: value === tag ? '#0f172a' : '#cbd5e1', bgcolor: value === tag ? '#67e8f9' : 'transparent', borderColor: value === tag ? '#67e8f9' : '#475569', '&:hover': { bgcolor: value === tag ? '#a5f3fc' : '#334155', borderColor: '#67e8f9' } }}>{value} ({count})</Button>) : <Typography level="body-xs" sx={{ color: '#94a3b8' }}>No tags available yet.</Typography>}
        </Box>}
      </Stack>
    </Sheet>
    <Box component="main" sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
      {error && <Alert color="danger" sx={{ mb: 2 }}>{error}</Alert>}
      {!loading && visible.length === 0 && <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No notes found.</Typography>}
      <Box className="joy-card-grid">{visible.slice(0, visibleLimit).map(note => <NoteCard key={note.id} note={note} namespace={namespace} admin={admin} condensed={style === 'condensed'} onOpen={setOpen} onDelete={value => void DeleteNote(value)} onTag={ToggleTag} />)}</Box>
      {visible.length > visibleLimit && <Button variant="outlined" color="neutral" sx={{ mt: 3 }} onClick={() => setVisibleLimit(limit => limit + 100)}>Show more notes ({visible.length - visibleLimit} remaining)</Button>}
    </Box>
    <Modal open={Boolean(open)} onClose={() => setOpen(null)}><ModalDialog layout="center" sx={{ width: 'min(900px, 94vw)', maxHeight: '90vh', overflow: 'auto' }}>
      {open && <><Stack direction="row" spacing={1} alignItems="center"><Typography level="h2" sx={{ flex: 1 }}>{open.title}</Typography>{admin && <Button component="a" href={NoteURL(open.id, namespace, true)} startDecorator={<i className="bi bi-pencil" />}>Edit</Button>}{admin && <Button variant="outlined" color="danger" onClick={() => void DeleteNote(open)}>Delete</Button>}<IconButton variant="plain" aria-label="Close" onClick={() => setOpen(null)}><i className="bi bi-x-lg" /></IconButton></Stack>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}><Chip size="sm" variant="soft">{NoteType(open)}</Chip>{open.source && <Chip size="sm" variant="outlined">Source: {open.source}</Chip>}{open.author && <Chip size="sm" variant="outlined">Author: {open.author}</Chip>}{NoteDate(open) && <Chip size="sm" variant="outlined">{NoteDate(open)}</Chip>}</Stack>
        {open.url && <Button component="a" href={open.url} target="_blank" rel="noopener noreferrer" variant="outlined" color="neutral" startDecorator={<i className="bi bi-box-arrow-up-right" />} sx={{ alignSelf: 'start' }}>Open link</Button>}
        <Box className="joy-markdown" dangerouslySetInnerHTML={{ __html: RenderMarkdown(open.body || '') }} />
        {GetDiagramScene(open) ? <Stack spacing={1}><DiagramIndicator /><Button component="a" href={NoteURL(open.id, namespace)} startDecorator={<i className="bi bi-diagram-3" />} sx={{ alignSelf: 'center' }}>Open diagram</Button></Stack> : open.data && <Box component="pre" sx={{ overflow: 'auto', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>{JSON.stringify(open.data, null, 2)}</Box>}
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>{(open.tags || []).map(value => <Button key={value} size="sm" variant="soft" color="neutral" sx={tagButtonSx} onClick={() => { ToggleTag(value); setOpen(null); }}>{value}</Button>)}</Stack>
      </>}
    </ModalDialog></Modal>
  </Box></JoyShell>;
}

// MountDesktopApp mounts the Joy desktop browser.
export function MountDesktopApp(): void {
  const element = document.getElementById('react-desktop-root');
  if (element) createRoot(element).render(<DesktopApp />);
}

MountDesktopApp();
