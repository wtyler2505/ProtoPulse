/**
 * Vault Search — Ars Contexta knowledge vault indexer for AI grounding.
 *
 * Loads all markdown notes from the vault at startup, parses frontmatter,
 * and exposes a Fuse.js-backed fuzzy search interface. Results are formatted
 * as compact prompt snippets for injection into AI system prompts.
 *
 * The vault is Tyler's curated electronics inventory knowledge (ProtoPulse's
 * authoritative domain source — see knowledge/ and ops/ directories). Claims
 * here supersede training-data knowledge for this inventory.
 */

import fs from 'node:fs';
import path from 'node:path';
import Fuse from 'fuse.js';

export interface VaultNote {
  slug: string;
  path: string;
  title: string;
  description: string;
  type: string;
  topics: string[];
  body: string;
  links: string[];
}

export interface VaultSearchResult {
  note: VaultNote;
  score: number;
  matchedSnippets: string[];
}

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;

/**
 * Parse a raw markdown file content into a VaultNote.
 * Frontmatter fields extracted: description, type, topics (array).
 * Wiki-links harvested from body.
 */
export function parseVaultNote(slug: string, absPath: string, raw: string): VaultNote {
  let description = '';
  let type = '';
  const topics: string[] = [];
  let body = raw;

  const fmMatch = raw.match(FRONTMATTER_RE);
  if (fmMatch) {
    const fmBlock = fmMatch[1];
    body = raw.slice(fmMatch[0].length);

    // Parse key: value pairs (single-line) for description + type
    for (const line of fmBlock.split('\n')) {
      const kv = line.match(/^(\w+)\s*:\s*(.*)$/);
      if (kv) {
        const key = kv[1];
        const value = kv[2].trim().replace(/^["']|["']$/g, '');
        if (key === 'description') description = value;
        else if (key === 'type') type = value;
      }
    }

    // Parse topics: multiline array form
    //   topics:
    //     - "[[foo]]"
    //     - "[[bar]]"
    const topicsBlockMatch = fmBlock.match(/topics\s*:\s*\n((?:\s*-\s*.*\n?)*)/);
    if (topicsBlockMatch) {
      const topicsBlock = topicsBlockMatch[1];
      for (const line of topicsBlock.split('\n')) {
        const m = line.match(/^\s*-\s*["']?\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]["']?\s*$/);
        if (m) topics.push(m[1].trim());
      }
    }
  }

  // Title: first H1 in body, else slug
  const h1Match = body.match(/^#\s+(.+)$/m);
  const title = h1Match ? h1Match[1].trim() : slug;

  // Harvest wiki-links from body
  const links: string[] = [];
  let lm: RegExpExecArray | null;
  while ((lm = WIKILINK_RE.exec(body)) !== null) {
    const target = lm[1].trim();
    if (!links.includes(target)) links.push(target);
  }

  return { slug, path: absPath, title, description, type, topics, body, links };
}

/**
 * Indexed, searchable snapshot of the vault.
 * Load via `await VaultSearchIndex.load(vaultRoot)`.
 */
export class VaultSearchIndex {
  private notes: VaultNote[];
  private bySlug: Map<string, VaultNote>;
  private fuse: Fuse<VaultNote>;

  private constructor(notes: VaultNote[]) {
    this.notes = notes;
    this.bySlug = new Map(notes.map(n => [n.slug, n]));
    this.fuse = new Fuse(notes, {
      keys: [
        { name: 'title', weight: 0.35 },
        { name: 'description', weight: 0.3 },
        { name: 'slug', weight: 0.2 },
        { name: 'body', weight: 0.15 },
      ],
      includeScore: true,
      includeMatches: true,
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 3,
      useExtendedSearch: false,
    });
  }

  static async load(vaultRoot: string): Promise<VaultSearchIndex> {
    if (!fs.existsSync(vaultRoot)) {
      return new VaultSearchIndex([]);
    }
    const entries = await fs.promises.readdir(vaultRoot, { withFileTypes: true });
    const mdFiles = entries.filter(e => e.isFile() && e.name.endsWith('.md'));
    const notes: VaultNote[] = [];
    for (const entry of mdFiles) {
      const absPath = path.join(vaultRoot, entry.name);
      const slug = entry.name.replace(/\.md$/, '');
      try {
        const raw = await fs.promises.readFile(absPath, 'utf8');
        notes.push(parseVaultNote(slug, absPath, raw));
      } catch {
        // Skip unreadable files silently — vault integrity is not this module's job.
      }
    }
    return new VaultSearchIndex(notes);
  }

  size(): number {
    return this.notes.length;
  }

  search(query: string, topK: number = 5): VaultSearchResult[] {
    if (!query.trim()) return [];
    const raw = this.fuse.search(query, { limit: topK });
    return raw.map(r => ({
      note: r.item,
      // Fuse score: 0 = perfect match, 1 = no match. Invert for intuitive 0-1.
      score: typeof r.score === 'number' ? 1 - r.score : 0,
      matchedSnippets: extractSnippets(r.item.body, query),
    }));
  }

  getNote(slug: string): VaultNote | undefined {
    return this.bySlug.get(slug);
  }

  getMOCNotes(): VaultNote[] {
    return this.notes.filter(n => n.type === 'moc');
  }

  getAtomicNotes(): VaultNote[] {
    return this.notes.filter(n => n.type !== 'moc');
  }

  /**
   * Format search results as a compact system-prompt section.
   * Capped at ~6KB to avoid blowing AI context budgets.
   */
  formatForPrompt(results: VaultSearchResult[]): string {
    if (results.length === 0) return '';
    const MAX_TOTAL_CHARS = 6000;
    const lines: string[] = [
      '## INVENTORY KNOWLEDGE (verified claims from Tyler\'s ProtoPulse vault)',
      'These are authoritative domain claims for this inventory. They supersede general training-data knowledge when in conflict.',
      '',
    ];
    let used = lines.join('\n').length;
    for (const r of results) {
      const snippet = r.note.description || firstMeaningfulLine(r.note.body);
      const entry = `- **${r.note.title}** — ${snippet}`;
      if (used + entry.length + 1 > MAX_TOTAL_CHARS) break;
      lines.push(entry);
      used += entry.length + 1;
    }
    return lines.join('\n');
  }
}

/**
 * Extract small context snippets around query terms in the body.
 * Returns up to 3 snippets, each ≤ 200 chars.
 */
function extractSnippets(body: string, query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length >= 3)
    .slice(0, 5);
  if (terms.length === 0) return [];
  const snippets: string[] = [];
  const lower = body.toLowerCase();
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx >= 0 && snippets.length < 3) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(body.length, idx + term.length + 120);
      const raw = body.slice(start, end).replace(/\s+/g, ' ').trim();
      snippets.push((start > 0 ? '…' : '') + raw + (end < body.length ? '…' : ''));
    }
  }
  return snippets;
}

function firstMeaningfulLine(body: string): string {
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('#')) continue;
    if (t.startsWith('---')) continue;
    return t.length > 200 ? t.slice(0, 200) + '…' : t;
  }
  return '';
}
