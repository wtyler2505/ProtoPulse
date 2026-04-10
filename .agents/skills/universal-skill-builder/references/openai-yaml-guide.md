# `agents/openai.yaml` Guide

## Why Add It

`agents/openai.yaml` is optional. Add it when you need:

- a better display name
- a short app-facing description
- icon and brand metadata
- a default prompt
- explicit invocation policy
- tool dependency hints

## Common Fields

```yaml
interface:
  display_name: "User-facing skill name"
  short_description: "Short summary"
  icon_small: "./assets/icon-small.svg"
  brand_color: "#3B82F6"
  default_prompt: "Suggested prompt wrapper"

policy:
  allow_implicit_invocation: false

dependencies:
  tools:
    - type: "mcp"
      value: "openaiDeveloperDocs"
      description: "OpenAI Docs MCP server"
      transport: "streamable_http"
      url: "https://developers.openai.com/mcp"
```

## Invocation Policy

- `true` is the default and works well for domain skills.
- `false` is often better for meta-skills, admin skills, or skills that should only run when explicitly requested.

## Dependency Guidance

- Only declare dependencies that materially improve the workflow.
- Prefer official or already-supported integrations.
- Do not invent dependency formats you cannot support.
