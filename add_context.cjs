const fs = require('fs');
const path = require('path');

const knowledgeDir = path.join(__dirname, 'knowledge');

function getFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const fm = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      let val = line.slice(colonIdx + 1).trim();
      // Strip matching quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      fm[key] = val;
    }
  }
  return fm;
}

const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md'));
let modifiedFiles = 0;

for (const file of files) {
  const filePath = path.join(knowledgeDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fmStr = fmMatch ? fmMatch[0] : '';
  const bodyStr = fmMatch ? content.slice(fmStr.length) : content;
  
  const fm = getFrontmatter(content);
  
  if (fm.type === 'moc') {
    let modified = false;
    
    const lines = bodyStr.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      const match = line.match(/^(\s*-\s*)\[\[([^\]|]+)(?:\|[^\]]+)?\]\]\s*$/);
      if (match) {
        const prefix = match[1];
        const targetFile = match[2] + '.md';
        const targetPath = path.join(knowledgeDir, targetFile);
        
        if (fs.existsSync(targetPath)) {
          const targetContent = fs.readFileSync(targetPath, 'utf-8');
          const targetFm = getFrontmatter(targetContent);
          
          if (targetFm.description) {
            lines[i] = `${prefix}[[${match[2]}]] — ${targetFm.description}`;
            modified = true;
          }
        }
      }
    }
    
    if (modified) {
      const newContent = fmStr + bodyStr.substring(0, bodyStr.indexOf(lines[0])) + lines.join('\n');
      // Actually, splitting by \n means we should join by \n
      // Better way:
      const newBody = lines.join('\n');
      fs.writeFileSync(filePath, fmStr + (fmStr ? '\n' : '') + newBody.replace(/^\n/, ''), 'utf-8');
      console.log(`Updated ${file}`);
      modifiedFiles++;
    }
  }
}

console.log(`Finished processing. Modified ${modifiedFiles} files.`);
