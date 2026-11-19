import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Divider, Drawer, FormControl, FormLabel, IconButton, Input, Option, Select, Sheet, Stack, Switch, Tab, TabList, Tabs, Textarea, Tooltip, Typography } from '@mui/joy';
import { useColorScheme } from '@mui/joy/styles';
import type { NoteData } from '../shared/types.js';
import { getCacheKeys, invalidateCache, isNoteCacheEnabled, setNoteCacheEnabled } from '../components/cache.js';
import { GetColor, SetColor, type ColorScope } from '../preferences/colors.js';
import { RenderMarkdown } from '../shared/markdown.js';
import { GetNoteSortMode, SetNoteSortMode, type NoteSortMode } from '../preferences/noteSort.js';
import { GetAdminSession, GetNamespaces, RequestJSON, type AdminSession } from './api.js';

type Template = { id: string; name: string; description?: string; body: string; tags?: string[] };
type TabName = 'templates' | 'namespaces' | 'colors' | 'cache';

// AdminPanel manages sessions, templates, namespaces, and browser preferences.
export function AdminPanel({ notes, noteCount, cardStyle, onCardStyleChange, onSortChange, onSessionChange, onNamespaceChange, onColorChange }: {
  notes: NoteData[];
  noteCount: number;
  cardStyle: string;
  onCardStyleChange: (value: string) => void;
  onSortChange: (value: NoteSortMode) => void;
  onSessionChange: (admin: boolean) => void;
  onNamespaceChange: () => void;
  onColorChange: () => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<AdminSession>({ admin: false, configured: false });
  const [token, setToken] = useState('');
  const [tab, setTab] = useState<TabName>('colors');
  const [sort, setSort] = useState<NoteSortMode>(GetNoteSortMode);
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
  const { mode, setMode } = useColorScheme();

  useEffect(() => {
    void GetAdminSession().then(value => { setSession(value); onSessionChange(value.admin); }).catch(() => setStatus('Unable to check admin session.'));
  }, [onSessionChange]);

  useEffect(() => {
    if (!open || !session.admin) return;
    void RequestJSON<{ templates: Template[] }>('/v1/admin/templates').then(value => setTemplates(value.templates || [])).catch(() => setStatus('Unable to load templates.'));
    void GetNamespaces().then(setNamespaces).catch(() => setStatus('Unable to load namespaces.'));
  }, [open, session.admin]);

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
    try { await RequestJSON('/v1/admin/session', { method: 'DELETE' }); setSession({ ...session, admin: false }); setTab('colors'); onSessionChange(false); setStatus('Signed out.'); }
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
    if (!name.trim() || !body.trim()) { setStatus('Template name and body are required.'); return; }
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

  return <>
    <Tooltip title="Tools"><IconButton variant="outlined" className="joy-header-action" aria-label="Open tools" onClick={() => setOpen(true)}><i className="bi bi-sliders" /></IconButton></Tooltip>
    <Drawer open={open} anchor="right" size="md" onClose={() => setOpen(false)} sx={{ '--Drawer-horizontalSize': 'min(780px, 100vw)' }}>
      <Sheet className="joy-tools" sx={{ height: '100%', overflowY: 'auto', p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}><Typography level="h2" sx={{ flex: 1 }}>Tools</Typography><IconButton variant="plain" aria-label="Close tools" onClick={() => setOpen(false)}><i className="bi bi-x-lg" /></IconButton></Stack>
        {status && <Alert color={status.startsWith('Unable') ? 'danger' : 'success'} sx={{ mb: 2 }}>{status}</Alert>}
        {!session.configured && <Typography color="neutral">Admin authentication is not configured.</Typography>}
        {session.configured && !session.admin && <Box component="form" onSubmit={event => void Login(event)}><Stack spacing={1.5}><FormControl><FormLabel>Admin token</FormLabel><Input type="password" autoComplete="current-password" value={token} onChange={event => setToken(event.target.value)} /></FormControl><Button type="submit">Sign in</Button></Stack></Box>}
        {session.admin && <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}><Button variant="outlined" color="neutral" onClick={() => void Logout()}>Sign out</Button></Stack>}
          <Tabs value={tab} onChange={(_, value) => { if (value) setTab(value as TabName); }}>
            <TabList sx={{ overflowX: 'auto' }}>{(session.admin ? ['namespaces', 'colors', 'templates'] : ['colors']).map(value => <Tab key={value} value={value} sx={{ textTransform: 'capitalize' }}>{value === 'colors' ? 'Preferences' : value}</Tab>)}</TabList>
          </Tabs>
          {session.admin && tab === 'templates' && <Stack component="details" spacing={2} sx={{ pt: 2 }}>
            <Typography component="summary" level="title-lg">Markdown templates</Typography>
            {templates.map(template => <Sheet key={template.id} variant="outlined" sx={{ p: 1.25, borderRadius: 'sm' }}><Stack direction="row" alignItems="center" spacing={1}><Typography level="title-sm" sx={{ flex: 1 }}>{template.name}</Typography><Button size="sm" variant="plain" onClick={() => EditTemplate(template)}>Edit</Button><Button size="sm" variant="plain" color="danger" onClick={() => void DeleteTemplate(template)}>Delete</Button></Stack>{template.description && <Typography level="body-sm">{template.description}</Typography>}</Sheet>)}
            <Divider />
            <Box component="form" onSubmit={event => void SaveTemplate(event)}><Stack spacing={1.5}>
              <Typography level="title-md">{editing ? 'Edit template' : 'New template'}</Typography>
              <FormControl><FormLabel>Name</FormLabel><Input required value={name} onChange={event => setName(event.target.value)} /></FormControl>
              <FormControl><FormLabel>Description</FormLabel><Input value={description} onChange={event => setDescription(event.target.value)} /></FormControl>
              <FormControl><FormLabel>Tags</FormLabel><Input value={tags} onChange={event => setTags(event.target.value)} placeholder="Comma separated" /></FormControl>
              <Stack direction="row" spacing={0.5}><Button size="sm" variant={preview ? 'plain' : 'solid'} onClick={() => setPreview(false)}>Write</Button><Button size="sm" variant={preview ? 'solid' : 'plain'} onClick={() => setPreview(true)}>Preview</Button></Stack>
              {preview ? <Sheet variant="outlined" className="joy-markdown" sx={{ minHeight: 180, p: 1.5, borderRadius: 'sm' }} dangerouslySetInnerHTML={{ __html: RenderMarkdown(body) }} /> : <FormControl><FormLabel>Body</FormLabel><Textarea required minRows={8} value={body} onChange={event => setBody(event.target.value)} /></FormControl>}
              <Stack direction="row" spacing={1}><Button type="submit">Save template</Button>{editing && <Button variant="outlined" color="neutral" onClick={() => EditTemplate(null)}>Cancel edit</Button>}</Stack>
            </Stack></Box>
          </Stack>}
          {session.admin && tab === 'namespaces' && <Stack component="details" spacing={1.5} sx={{ pt: 2 }}><Typography component="summary" level="title-lg">Namespaces</Typography>{namespaces.map(value => <Sheet key={value} variant="outlined" sx={{ p: 1, borderRadius: 'sm' }}><Stack direction="row" alignItems="center"><Typography sx={{ flex: 1 }}>{value}</Typography><Button size="sm" variant="plain" color="danger" onClick={() => void DeleteNamespace(value)}>Delete</Button></Stack></Sheet>)}</Stack>}
          {tab === 'colors' && <Stack className="joy-preferences" spacing={2} sx={{ pt: 2 }} data-color-version={colorVersion}>
            <Stack component="details" spacing={1.5}><Typography component="summary" level="title-lg">Appearance</Typography>
            <Sheet variant="outlined" sx={{ p: 1.5, borderRadius: 'sm' }}><Stack direction="row" alignItems="center" spacing={1}><i className={`bi bi-${mode === 'dark' ? 'moon-stars' : 'sun'}`} /><Typography sx={{ flex: 1 }}>Night mode</Typography><Switch checked={mode === 'dark'} onChange={event => setMode(event.target.checked ? 'dark' : 'light')} slotProps={{ input: { 'aria-label': 'Night mode' } }} /></Stack></Sheet>
            <Typography level="title-sm">Visible notes: {noteCount}</Typography><FormControl><FormLabel>Order</FormLabel><Select slotProps={{ listbox: { disablePortal: true } }} value={sort} onChange={(_, value) => { if (value) { setSort(value); SetNoteSortMode(value); onSortChange(value); } }}><Option value="smart">Smart</Option><Option value="title-asc">Title A–Z</Option><Option value="title-desc">Title Z–A</Option></Select></FormControl><FormControl><FormLabel>Card style</FormLabel><Select slotProps={{ listbox: { disablePortal: true } }} value={cardStyle} onChange={(_, value) => { if (value) onCardStyleChange(value); }}><Option value="comfortable">Comfortable</Option><Option value="condensed">Condensed</Option></Select></FormControl></Stack>
            <Stack component="details" spacing={2}><Typography component="summary" level="title-lg">Colors</Typography>{colorGroups.map(([scope, keys]) => <Box key={scope}><Typography level="title-sm" sx={{ textTransform: 'capitalize', mb: 1 }}>{scope}</Typography><Stack spacing={0.75}>{keys.map(key => <Sheet key={key} variant="outlined" sx={{ p: 1, borderRadius: 'sm' }}><Stack direction="row" alignItems="center" spacing={1}><Typography sx={{ flex: 1 }}>{key}</Typography><input type="color" aria-label={`${key} color`} value={GetColor(scope, key) || '#6366f1'} onChange={event => ChangeColor(scope, key, event.target.value)} /><Button size="sm" variant="plain" onClick={() => ChangeColor(scope, key, null)}>Reset</Button></Stack></Sheet>)}</Stack></Box>)}</Stack>
            <Stack component="details" spacing={2}><Typography component="summary" level="title-lg">Cache</Typography><Stack direction="row" alignItems="center" spacing={1}><Switch checked={cacheEnabled} onChange={event => { setCacheEnabled(event.target.checked); setNoteCacheEnabled(event.target.checked); }} /><Typography>Cache notes in this browser</Typography></Stack><Typography level="body-sm">{getCacheKeys().length} cached queries</Typography><Button variant="outlined" onClick={() => { invalidateCache(); setStatus('Cache cleared.'); }}>Clear cache</Button><Box component="details"><Typography component="summary" level="body-sm">Cached queries</Typography><Box component="ul">{getCacheKeys().map(key => <li key={key}>{key}</li>)}</Box></Box></Stack></Stack>}
      </Sheet>
    </Drawer>
  </>;
}
