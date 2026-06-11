import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { z } from 'zod';
import { VerifiedFactSchema, type VerifiedFact } from '../db/schema';

const SEARCH_DIRS = ['docs/parts', 'knowledge'];

export const KnowledgeLookupResultSchema = z.object({
  partNumber: z.string(),
  sourcePath: z.string().optional(),
  facts: z.record(VerifiedFactSchema),
  missingFacts: z.array(z.string()),
});

export type KnowledgeLookupResult = z.infer<typeof KnowledgeLookupResultSchema>;

export async function loadVerifiedHardwareFacts(
  partNumber: string,
  requiredFacts: string[],
  repoRoot = process.cwd(),
): Promise<KnowledgeLookupResult> {
  const files = await listMarkdownFiles(repoRoot);
  const match = await findBestPartMatch(repoRoot, files, partNumber);
  const facts: Record<string, VerifiedFact> = {};

  if (match) {
    for (const fact of requiredFacts) {
      const value = extractFact(match.content, fact);
      if (value != null) {
        facts[fact] = VerifiedFactSchema.parse({
          key: fact,
          value,
          source: match.path,
          status: 'verified',
        });
      }
    }
  }

  return KnowledgeLookupResultSchema.parse({
    partNumber,
    sourcePath: match?.path,
    facts,
    missingFacts: requiredFacts.filter((fact) => !(fact in facts)),
  });
}

async function listMarkdownFiles(repoRoot: string): Promise<string[]> {
  const results: string[] = [];
  for (const dir of SEARCH_DIRS) {
    await collectMarkdownFiles(join(repoRoot, dir), repoRoot, results);
  }
  return results;
}

async function collectMarkdownFiles(dir: string, repoRoot: string, results: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectMarkdownFiles(fullPath, repoRoot, results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(relative(repoRoot, fullPath));
    }
  }
}

async function findBestPartMatch(
  repoRoot: string,
  files: string[],
  partNumber: string,
): Promise<{ path: string; content: string } | undefined> {
  const normalizedNeedle = normalize(partNumber);
  const matches: Array<{ path: string; content: string; score: number }> = [];
  const tokens = normalizedNeedle.split(' ').filter((token) => token.length > 1);
  for (const path of files) {
    const content = await readFile(join(repoRoot, path), 'utf8');
    const normalizedPath = normalize(path);
    const title = normalize(matchLine(content, /^#\s+(.+)$/m) ?? '');
    const frontmatter = normalize(content.slice(0, 2000));
    const haystack = normalize(`${path}\n${content.slice(0, 5000)}`);
    const pathHits = tokens.filter((token) => normalizedPath.includes(token)).length;
    const titleHits = tokens.filter((token) => title.includes(token)).length;
    const frontmatterHits = tokens.filter((token) => frontmatter.includes(token)).length;
    const bodyHits = tokens.filter((token) => haystack.includes(token)).length;
    const score =
      pathHits * 20
      + titleHits * 12
      + frontmatterHits * 4
      + bodyHits
      + (path.startsWith('docs/parts/') ? 5 : 0);

    if (pathHits >= 2 || titleHits >= 2 || frontmatterHits >= Math.max(2, tokens.length - 1)) {
      matches.push({ path, content, score });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return matches[0];
}

function extractFact(content: string, fact: string): unknown {
  const frontmatter = extractFrontmatter(content);
  if (fact === 'logic_voltage') {
    return frontmatter.logic_level ?? matchLine(content, /Operating Voltage\*\*:\s*([^\n]+)/i);
  }
  if (fact === 'pinout') {
    return frontmatter.pinout ?? section(content, /## Headers & Pinout/i, /## Critical Safety|## /i) ?? section(content, /## Pinout/i, /## /i);
  }
  if (fact === 'usb_interface') {
    const usbLine = matchLine(content, /\|\s*USB\s*\|\s*([^|]+)\|/i)
      ?? matchLine(content, /USB(?:-Serial)?(?: Chip)?\s*\|\s*([^|\n]+)/i);
    return usbLine ?? (/\bUSB-B\b/i.test(content) ? 'USB-B' : /\bUSB\b/i.test(content) ? 'USB' : undefined);
  }
  if (fact === 'board_dimensions') {
    return frontmatter.dimensions_mm ?? matchLine(content, /Dimensions\*\*:\s*([^\n]+)/i);
  }
  return frontmatter[fact];
}

function extractFrontmatter(content: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^"|"$/g, '');
    result[key] = value;
  }
  return result;
}

function matchLine(content: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(content);
  return match?.[1]?.trim();
}

function section(content: string, startPattern: RegExp, nextPattern: RegExp): string | undefined {
  const start = content.search(startPattern);
  if (start === -1) {
    return undefined;
  }
  const rest = content.slice(start);
  const next = rest.slice(1).search(nextPattern);
  return (next === -1 ? rest : rest.slice(0, next + 1)).trim();
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
