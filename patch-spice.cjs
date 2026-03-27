const fs = require('fs');
const file = 'server/export/spice-exporter.ts';
let code = fs.readFileSync(file, 'utf8');

const sanitizerFn = `

function sanitizeSpiceToken(val: unknown): string {
  if (val == null) return '';
  // Strip newlines, carriage returns, and control characters to prevent SPICE directive injection
  const str = String(val).replace(/[\\r\\n\\x00-\\x1F]+/g, ' ').trim();
  // Allow alphanumeric, basic symbols for values/names, drop potentially executable shell sequences
  // We keep space because some models/types might be separated by space
  return str.replace(/[^a-zA-Z0-9_:.+\\- ]/g, '');
}
`;

if (!code.includes('sanitizeSpiceToken')) {
  code = code.replace('function getFamily', sanitizerFn + 'function getFamily');
}

// Replace props interpolations
code = code.replace(/const value = props\.value \|\| props\.resistance \|\| '1k';/g, "const value = sanitizeSpiceToken(props.value || props.resistance || '1k');");
code = code.replace(/const value = props\.value \|\| props\.capacitance \|\| '100n';/g, "const value = sanitizeSpiceToken(props.value || props.capacitance || '100n');");
code = code.replace(/const value = props\.value \|\| props\.inductance \|\| '10u';/g, "const value = sanitizeSpiceToken(props.value || props.inductance || '10u');");
code = code.replace(/const modelName = props\.model \|\| /g, "const modelName = sanitizeSpiceToken(props.model) || ");
code = code.replace(/props\.Is \|\|/g, "sanitizeSpiceToken(props.Is) ||");
code = code.replace(/props\.N \|\|/g, "sanitizeSpiceToken(props.N) ||");
code = code.replace(/props\.BF \|\|/g, "sanitizeSpiceToken(props.BF) ||");
code = code.replace(/props\.type \|\|/g, "sanitizeSpiceToken(props.type) ||");

// Patch DC sweep source name
code = code.replace(/\$\{dcSweep\.sourceName\}/g, "${sanitizeSpiceToken(dcSweep.sourceName)}");
code = code.replace(/\$\{req\.analysisType\}/g, "${sanitizeSpiceToken(req.analysisType)}");

fs.writeFileSync(file, code);
