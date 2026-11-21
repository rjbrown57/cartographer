import type { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { GetNamespaces, GetNotes } from './api.js';
import { NoteURL } from './navigation.js';

type LinkTarget = { id: string; title: string; namespace: string };
export type LinkSearchStatus = { message: string; retry: boolean };

// CreateNoteLinkSource keeps a lightweight note index for one editor session.
export function CreateNoteLinkSource(current: () => { id?: string; namespace: string }, report: (status: LinkSearchStatus) => void) {
  const targets = new Map<string, LinkTarget[]>();
  let namespaces: string[] | null = null;
  let loading: Promise<void> | null = null;
  let attempted = false;

  // LoadTargets fetches missing namespaces with bounded concurrency and keeps successes for retry.
  async function LoadTargets(): Promise<void> {
    report({ message: 'Loading cards…', retry: false });
    try {
      namespaces ??= await GetNamespaces();
      const pending = namespaces.filter(namespace => !targets.has(namespace));
      await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
        while (pending.length) {
          const namespace = pending.shift()!;
          try {
            const notes = await GetNotes(namespace);
            targets.set(namespace, notes.map(note => ({ id: note.id, title: note.title || note.id, namespace })));
          } catch { /* Successful namespaces remain searchable while failed ones can be retried. */ }
        }
      }));
      const failed = namespaces.filter(namespace => !targets.has(namespace));
      report({ message: failed.length ? `Unable to load cards from ${failed.join(', ')}.` : '', retry: failed.length > 0 });
    } catch {
      report({ message: 'Unable to load namespaces.', retry: true });
    }
  }

  // Load shares an in-flight request across completion queries.
  function Load(): Promise<void> {
    if (!loading) loading = LoadTargets().finally(() => { loading = null; });
    return loading;
  }

  // Source replaces a bracket query with a standard Markdown note link.
  async function Source(context: CompletionContext): Promise<CompletionResult | null> {
    const match = context.matchBefore(/\[\[[^\[\]\n]*$/);
    if (!match) return null;
    // Incomplete inline code and link destinations may not have syntax nodes yet.
    const linePrefix = context.state.sliceDoc(context.state.doc.lineAt(match.from).from, match.from);
    let codeDelimiter = '';
    for (const run of linePrefix.matchAll(/(?<!\\)`+/g)) {
      if (!codeDelimiter) codeDelimiter = run[0];
      else if (run[0] === codeDelimiter) codeDelimiter = '';
    }
    if (codeDelimiter || /\]\([^)]*$/.test(linePrefix)) return null;
    for (let node = syntaxTree(context.state).resolveInner(match.from, 1); node; node = node.parent!) {
      if (/^(FencedCode|CodeBlock|InlineCode|Link|Image|Autolink)$/.test(node.name)) return null;
    }
    if (!attempted) { attempted = true; await Load(); }
    else if (loading) await loading;
    if (context.aborted) return null;
    const query = match.text.slice(2).trim().toLocaleLowerCase();
    const self = current();
    const matches = [...targets.values()].flat().filter(note =>
      !(note.id === self.id && note.namespace === self.namespace) && note.title.toLocaleLowerCase().includes(query));
    // Rank puts exact and prefix title matches before other substring matches.
    const Rank = (title: string): number => title.toLocaleLowerCase() === query ? 0 : title.toLocaleLowerCase().startsWith(query) ? 1 : 2;
    matches.sort((a, b) => Rank(a.title) - Rank(b.title) || a.title.localeCompare(b.title) || a.namespace.localeCompare(b.namespace) || a.id.localeCompare(b.id));
    const options = matches.slice(0, 20).map(note => ({
      label: note.title,
      detail: matches.some(other => other !== note && other.namespace === note.namespace && other.title === note.title) ? `${note.namespace} · ${note.id}` : note.namespace,
      type: 'text',
      // Apply inserts one undoable change and consumes an existing closing bracket pair.
      apply(view: EditorView, _completion: unknown, from: number, to: number) {
        const label = note.title.replace(/\s+/g, ' ').replace(/[\\[\]`*_<>]/g, '\\$&');
        const url = NoteURL(note.id, note.namespace).replace(/[()]/g, char => char === '(' ? '%28' : '%29');
        const text = `[${label}](${url})`;
        const end = view.state.sliceDoc(to, to + 2) === ']]' ? to + 2 : to;
        view.dispatch({ changes: { from, to: end, insert: text }, selection: { anchor: from + text.length }, userEvent: 'input.complete' });
      },
    }));
    if (!options.length) return { from: match.from, filter: false, options: [{ label: 'No matching cards', apply: () => {} }] };
    return { from: match.from, filter: false, options };
  }

  // Retry reloads only failed namespaces and permits another completion request.
  async function Retry(): Promise<void> { await Load(); }
  return { source: Source, retry: Retry };
}
