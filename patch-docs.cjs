const fs = require('fs');

// 1. docs/DEVELOPER.md
let devMd = fs.readFileSync('docs/DEVELOPER.md', 'utf8');

devMd = devMd.replace(/│   │  │ Anthropic \+ Gemini │  │  │  IStorage \/ DatabaseStorage  │ │  │/g, '│   │  │ Google Genkit    │  │  │  IStorage / DatabaseStorage  │ │  │');
devMd = devMd.replace(/ai\.ts\s+# AI engine: 1,368 lines — Anthropic \+ Gemini,/g, 'ai.ts                            # AI engine: Genkit + Google AI,');
devMd = devMd.replace(/batch-analysis\.ts\s+# Anthropic Message Batches API integration/g, 'batch-analysis.ts                # Genkit Queue mocking for async analysis');
devMd = devMd.replace(/batch\.ts\s+# POST\/GET \/api\/batch\/\* \(Anthropic batch analysis\)/g, 'batch.ts                     # POST/GET /api/batch/* (Async batch analysis)');
devMd = devMd.replace(/`provider` \| `text` \| NOT NULL \| `anthropic` or `gemini`/g, '`provider` | `text` | NOT NULL | `gemini`');
devMd = devMd.replace(/`ai_provider` \| `text` \| NOT NULL, DEFAULT `anthropic` \| \|/g, '`ai_provider` | `text` | NOT NULL, DEFAULT `gemini` | |');
devMd = devMd.replace(/"provider": "anthropic" \| "gemini",/g, '"provider": "gemini",');
devMd = devMd.replace(/Requires `X-Anthropic-Key` header \(not X-Session-Id\)\./g, 'Requires `X-Gemini-Key` header (not X-Session-Id).');
devMd = devMd.replace(/calls either Anthropic Claude or Google Gemini/g, 'calls Google Genkit');
devMd = devMd.replace(/Anthropic Message Batches API integration for async background analysis/g, 'Genkit queue mocking for async background analysis');
devMd = devMd.replace(/Stored API keys \(Anthropic, Gemini\) are encrypted/g, 'Stored API keys (Gemini) are encrypted');
devMd = devMd.replace(/Batch analysis \(Anthropic Message Batches API\)/g, 'Batch analysis (Genkit Queues)');

fs.writeFileSync('docs/DEVELOPER.md', devMd, 'utf8');

// 2. docs/AI_AGENT_GUIDE.md
let aiGuide = fs.readFileSync('docs/AI_AGENT_GUIDE.md', 'utf8');

aiGuide = aiGuide.replace(/AI chat with 82 tool actions \(Anthropic \+ Gemini\)/g, 'AI chat with 88 tool actions (Google Genkit)');
aiGuide = aiGuide.replace(/AI providers \| Anthropic SDK \(Claude\), Google Generative AI \(Gemini\)/g, 'AI providers | Google Genkit');
aiGuide = aiGuide.replace(/exposes \*\*82 tool actions\*\* via the Anthropic\/Gemini function-calling API/g, 'exposes **88 tool actions** via the Google Genkit API');
aiGuide = aiGuide.replace(/AI provider \(Anthropic\/Gemini\) streams response via SSE using function-calling API/g, 'AI provider (Genkit) streams response via SSE using function-calling API');
aiGuide = aiGuide.replace(/- `always_claude` — force Anthropic Claude\n/g, '');
aiGuide = aiGuide.replace(/LRU cache \(size 10\) for Anthropic\/Gemini client instances/g, 'LRU cache (size 10) for Genkit client instances');

fs.writeFileSync('docs/AI_AGENT_GUIDE.md', aiGuide, 'utf8');

console.log('Patched docs');
