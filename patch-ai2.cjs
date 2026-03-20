const fs = require('fs');
const content = fs.readFileSync('server/ai.ts', 'utf8');

let newContent = content.replace(/import \{ anthropicBreaker, geminiBreaker, CircuitBreakerOpenError \} from "\.\/circuit-breaker";\n/g, '');

newContent = newContent.replace(/export async function checkToolContext(.+?)\{([\s\S]+?)return result;\n\}/g, '');

fs.writeFileSync('server/ai.ts', newContent, 'utf8');
