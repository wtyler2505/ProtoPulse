import fs from 'fs';
import path from 'path';

function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function processFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Track extracted keys
  const extractedKeys: Record<string, string> = {};

  // Simple regex for JSX Text (between > and <)
  // This is a naive regex and might need refinement, but it's a good start for a pipeline.
  const jsxTextRegex = />([^<{}]+)</g;
  content = content.replace(jsxTextRegex, (match, p1) => {
    const text = p1.trim();
    if (text && text.length > 1 && !/^[\s{}:;"']+$/.test(text)) {
      const key = toCamelCase(text.substring(0, 30)); // generate a simple key
      extractedKeys[key] = text;
      modified = true;
      return `>{t('${key}')}<`;
    }
    return match;
  });

  if (modified) {
    // Inject import and hook
    if (!content.includes("useI18n")) {
      const importStatement = "import { useI18n } from '@/lib/i18n';\n";
      // Find last import
      const importMatches = Array.from(content.matchAll(/^import .*;$/gm));
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertPos = (lastImport.index || 0) + lastImport[0].length;
        content = content.slice(0, insertPos) + '\n' + importStatement + content.slice(insertPos);
      } else {
        content = importStatement + content;
      }
    }

    // Naive hook injection (this would be better with AST)
    // Find the first component function
    const funcRegex = /(export\s+(?:default\s+)?function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*(?::\s*[A-Za-z0-9_<>]+\s*)?{)/;
    const match = content.match(funcRegex);
    if (match && !content.includes("const { t } = useI18n();")) {
      const insertPos = (match.index || 0) + match[0].length;
      content = content.slice(0, insertPos) + '\n  const { t } = useI18n();' + content.slice(insertPos);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Processed ${filePath}. Extracted ${Object.keys(extractedKeys).length} keys.`);
    
    // Output translations
    console.log("Add these to translations:");
    console.log(JSON.stringify(extractedKeys, null, 2));
  } else {
    console.log(`No strings found to extract in ${filePath}.`);
  }
}

const target = process.argv[2];
if (!target) {
  console.error("Please provide a file or directory path.");
  process.exit(1);
}

const stat = fs.statSync(target);
if (stat.isFile()) {
  processFile(target);
} else {
  console.log("Directory processing not implemented in this simple script yet.");
}
