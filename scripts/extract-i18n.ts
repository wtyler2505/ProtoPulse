import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENT_SRC = path.join(ROOT_DIR, 'client/src');

interface ExtractedString {
  file: string;
  line: number;
  text: string;
  type: 'JsxText' | 'StringLiteral';
}

function extractStringsFromFile(filePath: string): ExtractedString[] {
  const code = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const results: ExtractedString[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      const text = node.getText().trim();
      // Ignore empty strings, pure whitespace, or single punctuation marks
      if (text && text.length > 1 && !/^[\s{}:;"']+$/.test(text)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        results.push({
          file: path.relative(ROOT_DIR, filePath),
          line: line + 1,
          text,
          type: 'JsxText',
        });
      }
    } else if (ts.isStringLiteral(node) && ts.isJsxAttribute(node.parent)) {
      // e.g. placeholder="Search..." or title="Settings"
      const name = node.parent.name.getText();
      const validAttrs = ['placeholder', 'title', 'label', 'description', 'alt', 'aria-label'];
      if (validAttrs.includes(name)) {
        const text = node.text.trim();
        if (text) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          results.push({
            file: path.relative(ROOT_DIR, filePath),
            line: line + 1,
            text,
            type: 'StringLiteral',
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return results;
}

function findFiles(dir: string, extension: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, extension));
    } else if (filePath.endsWith(extension)) {
      results.push(filePath);
    }
  }
  return results;
}

function main() {
  console.log('Scanning for unextracted UI strings...');
  const files = findFiles(CLIENT_SRC, '.tsx');
  let totalStrings = 0;
  
  const allResults: Record<string, ExtractedString[]> = {};

  for (const file of files) {
    const strings = extractStringsFromFile(file);
    if (strings.length > 0) {
      allResults[file] = strings;
      totalStrings += strings.length;
    }
  }

  const reportPath = path.join(ROOT_DIR, 'reports/i18n-audit.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2));

  console.log(`Found ${totalStrings} hardcoded UI strings across ${Object.keys(allResults).length} files.`);
  console.log(`Detailed report saved to: reports/i18n-audit.json`);
  
  // Also generate a simple summary
  const summaryPath = path.join(ROOT_DIR, 'reports/i18n-audit-summary.txt');
  let summaryText = `i18n Unextracted Strings Audit Summary\n======================================\n\nTotal Unextracted Strings: ${totalStrings}\n\n`;
  for (const [file, strings] of Object.entries(allResults)) {
    const relFile = path.relative(ROOT_DIR, file);
    summaryText += `\n${relFile} (${strings.length} strings):\n`;
    for (const s of strings.slice(0, 5)) {
      summaryText += `  Line ${s.line}: "${s.text.substring(0, 50)}${s.text.length > 50 ? '...' : ''}"\n`;
    }
    if (strings.length > 5) {
      summaryText += `  ... and ${strings.length - 5} more.\n`;
    }
  }
  fs.writeFileSync(summaryPath, summaryText);
  console.log(`Summary report saved to: reports/i18n-audit-summary.txt`);
}

main();
