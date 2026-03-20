const fs = require('fs');

// 1. SettingsPanel.tsx
let sp = fs.readFileSync('client/src/components/panels/chat/SettingsPanel.tsx', 'utf8');

sp = sp.replace(/aiProvider: 'anthropic' \| 'gemini';/, "aiProvider: 'gemini';");
sp = sp.replace(/setAiProvider: \(provider: 'anthropic' \| 'gemini'\) => void;/, "setAiProvider: (provider: 'gemini') => void;");

// Remove the whole Provider fieldset
sp = sp.replace(/<fieldset className="border-none p-0 m-0">[\s\S]+?<\/fieldset>/, '');

// Fix model select mapping
sp = sp.replace(/AI_MODELS\[aiProvider as keyof typeof AI_MODELS\]/g, 'AI_MODELS.gemini');

// Fix API key placeholder and error message
sp = sp.replace(/aiProvider === 'anthropic' \? "sk-ant-\.\.\." : "Enter your API key\.\.\."/, '"Enter your API key..."');
sp = sp.replace(/aiProvider === 'anthropic' \? "Anthropic keys must start with 'sk-ant-'" : "API key appears too short"/, '"API key appears too short"');

// Fix Need a key link
sp = sp.replace(/\{aiProvider === 'anthropic' \? \([\s\S]+?\) : \([\s\S]+?<a href="https:\/\/aistudio\.google\.dev\/apikeys"[\s\S]+?aistudio\.google\.dev\/apikeys<\/a>\n\s*\)\}/, '<a href="https://aistudio.google.dev/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary/70 underline hover:text-white">aistudio.google.dev/apikeys</a>');

fs.writeFileSync('client/src/components/panels/chat/SettingsPanel.tsx', sp, 'utf8');

// 2. MessageInput.tsx
let mi = fs.readFileSync('client/src/components/panels/chat/MessageInput.tsx', 'utf8');
mi = mi.replace(/aiProvider: 'anthropic' \| 'gemini';/, "aiProvider: 'gemini';");
mi = mi.replace(/aiProvider === 'anthropic' \? 'Anthropic' : 'Gemini'/g, "'Gemini'");

fs.writeFileSync('client/src/components/panels/chat/MessageInput.tsx', mi, 'utf8');

// 3. ApiKeySetupDialog.tsx
let aksd = fs.readFileSync('client/src/components/panels/chat/ApiKeySetupDialog.tsx', 'utf8');
aksd = aksd.replace(/aiProvider: 'anthropic' \| 'gemini';/, "aiProvider: 'gemini';");
aksd = aksd.replace(/aiProvider === 'anthropic' \? 'Anthropic' : 'Gemini'/g, "'Gemini'");

fs.writeFileSync('client/src/components/panels/chat/ApiKeySetupDialog.tsx', aksd, 'utf8');

console.log('Patched UI files to remove anthropic');
