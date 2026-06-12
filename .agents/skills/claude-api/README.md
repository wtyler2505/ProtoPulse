# Claude API Skill

Complete knowledge for working with the Anthropic Messages API (Claude API).

## Quick Example

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude!' }],
});

console.log(message.content[0].text);
```

---

## Auto-Trigger Keywords

This skill automatically activates when you mention:

### Primary Keywords

**API & SDK**:
- claude api
- anthropic api
- messages api
- @anthropic-ai/sdk
- anthropic sdk
- claude typescript
- claude javascript
- claude node.js

**Core Features**:
- claude streaming
- claude prompt caching
- claude tool use
- claude function calling
- claude vision
- claude extended thinking
- claude image understanding

**Models**:
- claude 3.5 sonnet
- claude-sonnet-4-6
- claude 3.7 sonnet
- claude sonnet 4
- claude opus 4
- claude haiku

**Platform Integration**:
- claude cloudflare
- claude workers
- claude nextjs
- claude next.js api
- claude server

### Secondary Keywords

**Advanced Features**:
- anthropic messages
- claude multimodal
- claude sse streaming
- claude server-sent events
- prompt cache claude
- claude cost savings
- claude token optimization

**Tool Use**:
- claude tools
- claude agents
- tool calling claude
- function calling anthropic
- claude json schema
- zod claude tools

**Error & Optimization**:
- claude rate limit
- anthropic 429
- claude optimization
- claude best practices
- claude error handling

### Error-Based Keywords

**When you encounter these errors**:
- claude streaming error
- prompt cache not working
- anthropic 429 error
- claude rate limit exceeded
- claude tool use error
- claude vision format error
- claude api error
- streaming sse error
- cache_control not working
- tool_use_id mismatch
- invalid_request_error claude
- authentication_error anthropic

### Use Case Keywords

**When building**:
- chatbot with claude
- ai assistant claude
- document analysis claude
- code review claude
- claude integration
- claude backend
- claude api integration
- streaming chat claude
- real-time chat claude
- ai chat interface

---

## What This Skill Does

- ✅ Complete Messages API reference (all endpoints, parameters)
- ✅ Streaming responses with Server-Sent Events (SSE)
- ✅ Prompt caching for 90% cost savings
- ✅ Tool use (function calling) patterns
- ✅ Vision (image understanding) capabilities
- ✅ Extended thinking mode (Claude 3.7/4)
- ✅ Error handling and rate limits
- ✅ Cloudflare Workers, Next.js, Node.js examples
- ✅ 13 production-ready templates
- ✅ 12+ documented errors with solutions

---

## Known Issues Prevented

| Issue | Error Message | Solution In |
|-------|---------------|-------------|
| Rate limit 429 | "Too many requests" | templates/error-handling.ts |
| Streaming SSE errors | Incomplete chunks | templates/streaming-chat.ts |
| Prompt caching not working | cache_read_input_tokens: 0 | references/prompt-caching-guide.md |
| Tool schema errors | Invalid input_schema | templates/tool-use-basic.ts |
| Vision format issues | Invalid image source | templates/vision-image.ts |
| Token counting errors | Too many tokens | references/top-errors.md |
| System prompt ordering | Prompt ignored | templates/basic-chat.ts |
| Context window exceeded | Messages too long | references/api-reference.md |
| Thinking budget >= max_tokens | 400 invalid_request_error | templates/extended-thinking.ts |
| API key exposure | CORS errors | templates/cloudflare-worker.ts |
| Rate limit tier confusion | Lower than expected | references/rate-limits.md |
| Beta header missing | Unknown parameter | references/top-errors.md |

---

## When to Use This Skill

✅ **Use when:**
- Integrating Claude API into your application
- Building chatbots or AI assistants
- Implementing streaming responses
- Adding tool use (function calling)
- Processing images with vision
- Optimizing costs with prompt caching
- Handling rate limits and errors
- Deploying to Cloudflare Workers or Next.js

❌ **Don't use when:**
- You need Claude.ai web interface help (this is API-only)
- You want to use Claude Desktop features
- You need claude-agent-sdk (use that specific skill)

---

## File Structure

```
claude-api/
├── SKILL.md                      # Thin router into shared/ + language dirs
├── README.md (this file)         # Auto-trigger keywords
├── shared/                       # Concept guides (models, errors, caching, tools, agents)
├── typescript/ python/ curl/ go/ java/ php/ ruby/ csharp/   # Language guides
├── templates/ (13 files)         # Production-ready code
│   ├── basic-chat.ts
│   ├── streaming-chat.ts
│   ├── prompt-caching.ts
│   ├── tool-use-basic.ts
│   ├── tool-use-advanced.ts
│   ├── vision-image.ts
│   ├── extended-thinking.ts
│   ├── cloudflare-worker.ts
│   ├── nextjs-api-route.ts
│   ├── nodejs-example.ts
│   ├── error-handling.ts
│   ├── wrangler.jsonc
│   └── package.json
├── references/ (6 files)         # Deep-dive guides
│   ├── api-reference.md
│   ├── prompt-caching-guide.md
│   ├── tool-use-patterns.md
│   ├── vision-capabilities.md
│   ├── rate-limits.md
│   └── top-errors.md
└── scripts/
    └── check-versions.sh
```

---

## Quick Start

### 1. Get API Key

Sign up at https://console.anthropic.com/ and create an API key.

### 2. Install SDK

```bash
npm install @anthropic-ai/sdk
```

### 3. Use Template

Copy from `templates/basic-chat.ts` or other templates as needed.

---

## Key Features

### 🚀 Streaming Responses

Real-time text generation with Server-Sent Events.

**Template**: `templates/streaming-chat.ts`
**Guide**: Check SKILL.md "Streaming Responses" section

### 💰 Prompt Caching (90% Cost Savings)

Cache frequently used context for massive cost reduction.

**Template**: `templates/prompt-caching.ts`
**Guide**: `references/prompt-caching-guide.md`

### 🔧 Tool Use (Function Calling)

Let Claude use external tools and APIs.

**Templates**:
- `templates/tool-use-basic.ts`
- `templates/tool-use-advanced.ts`

**Guide**: `references/tool-use-patterns.md`

### 👁️ Vision (Image Understanding)

Process and analyze images.

**Template**: `templates/vision-image.ts`
**Guide**: `references/vision-capabilities.md`

### 🧠 Extended Thinking (Claude 3.7/4)

Deep reasoning for complex problems.

**Template**: `templates/extended-thinking.ts`
**Note**: Only works with Claude 3.7 Sonnet or Claude 4 models

### ⚡ Platform Support

- **Cloudflare Workers**: `templates/cloudflare-worker.ts`
- **Next.js**: `templates/nextjs-api-route.ts`
- **Node.js**: `templates/nodejs-example.ts`

---

## Most Common Use Cases

### 1. Chatbot with Streaming

```typescript
const stream = anthropic.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }]
});

stream.on('text', (text) => process.stdout.write(text));
await stream.finalMessage();
```

See: `templates/streaming-chat.ts`

### 2. Cost-Optimized Chat (Prompt Caching)

```typescript
const message = await anthropic.messages.create({
  system: [{
    type: 'text',
    text: LARGE_INSTRUCTIONS, // >= 1024 tokens
    cache_control: { type: 'ephemeral' }
  }],
  messages: [...]
});
```

See: `templates/prompt-caching.ts`

### 3. AI Agent with Tools

```typescript
const finalMessage = await anthropic.beta.messages.toolRunner({
  model: 'claude-sonnet-4-6',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'What is the weather in SF?' }],
  tools: [weatherTool]
});
```

See: `templates/tool-use-advanced.ts`

### 4. Image Analysis

```typescript
const message = await anthropic.messages.create({
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageData } },
      { type: 'text', text: 'What is in this image?' }
    ]
  }]
});
```

See: `templates/vision-image.ts`

---

## Troubleshooting

**Problem**: Rate limit errors (429)
**Solution**: See `references/rate-limits.md` and `templates/error-handling.ts`

**Problem**: Prompt caching not working
**Solution**: See `references/prompt-caching-guide.md` - ensure cache_control at END of block

**Problem**: Tool use errors
**Solution**: See `references/tool-use-patterns.md` - validate JSON schemas

**Problem**: Extended thinking not showing
**Solution**: Use Claude 3.7 Sonnet or Claude 4 models (NOT 3.5 Sonnet)

**Full Error Reference**: `references/top-errors.md`

---

## Package Versions

**Note (2026-06-11):** verify versions via Context7 (`/anthropics/anthropic-sdk-typescript`) before pinning — version pins rot; treat the numbers below as illustrative.

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "zod": "^3.23.0"
  }
}
```

---

## Official Documentation

- **API Reference**: https://platform.claude.com/docs/en/api/messages
- **Prompt Caching**: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- **Tool Use**: https://platform.claude.com/docs/en/build-with-claude/tool-use
- **Vision**: https://platform.claude.com/docs/en/build-with-claude/vision
- **Rate Limits**: https://platform.claude.com/docs/en/api/rate-limits
- **Errors**: https://platform.claude.com/docs/en/api/errors
- **TypeScript SDK**: https://github.com/anthropics/anthropic-sdk-typescript
- **Context7**: /anthropics/anthropic-sdk-typescript
- **Topic URL table**: `shared/live-sources.md`

---

**Related Skills**:
- claude-agent-sdk (for Anthropic Agent SDK)
- openai-api (for OpenAI API)
- ai-sdk-core (for Vercel AI SDK backend)
- ai-sdk-ui (for Vercel AI SDK frontend)

---

**Questions or Issues?**

1. Check SKILL.md for complete reference
2. Review templates for working examples
3. Read references for deep dives
4. Check official docs linked above
5. Verify setup with provided examples

---

**License**: MIT
