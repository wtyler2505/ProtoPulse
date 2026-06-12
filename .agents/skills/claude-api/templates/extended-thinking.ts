import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Extended thinking — current rules (see shared/models.md for the live catalog):
 *
 * - Opus 4.6 and Sonnet 4.6: use ADAPTIVE thinking — `thinking: { type: 'adaptive' }`.
 *   `budget_tokens` is deprecated on these models; the model decides how much to think.
 * - Older thinking-capable models: `thinking: { type: 'enabled', budget_tokens: N }`
 *   where N must be >= 1024 and < max_tokens.
 * - Thinking output arrives as `thinking` content blocks; the text lives in
 *   `block.thinking` (NOT `block.text`). Blocks also carry a `signature` used for
 *   verification when you pass them back in multi-turn tool-use conversations.
 * - Capability check at runtime: query the Models API
 *   (`client.models.retrieve(id)` → `capabilities.thinking.types.adaptive.supported`).
 */

// Example 1: Basic adaptive thinking (Sonnet 4.6 / Opus 4.6)
async function basicExtendedThinking() {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: `A ball is thrown upward with an initial velocity of 20 m/s.
        How high does it go? (Use g = 9.8 m/s²)`,
      },
    ],
  });

  console.log('=== Response with Extended Thinking ===\n');

  for (const block of message.content) {
    if (block.type === 'thinking') {
      console.log('Thinking:');
      console.log(block.thinking);
      console.log('\n' + '='.repeat(50) + '\n');
    } else if (block.type === 'text') {
      console.log('Final answer:');
      console.log(block.text);
    }
  }

  console.log('\nStop reason:', message.stop_reason);
  console.log('Token usage:', message.usage);
}

// Example 2: Budgeted thinking on an older thinking-capable model
// (only needed for pre-4.6 models — prefer adaptive on current models)
async function budgetedThinking() {
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5', // older model: budget_tokens still applies
    max_tokens: 16000,
    thinking: { type: 'enabled', budget_tokens: 8000 }, // >= 1024, < max_tokens
    messages: [
      {
        role: 'user',
        content: `Debug this Python code and explain what's wrong:

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-1)

print(fibonacci(10))

Why is it slow and what's the correct implementation?`,
      },
    ],
  });

  for (const block of message.content) {
    if (block.type === 'thinking') {
      console.log('Debugging process:');
      console.log(block.thinking);
      console.log();
    } else if (block.type === 'text') {
      console.log('Solution:');
      console.log(block.text);
    }
  }
}

// Example 3: Comparing with and without extended thinking (same model)
async function compareThinkingModes() {
  const problem = 'What is the sum of all prime numbers less than 100?';

  console.log('=== Without Extended Thinking ===\n');

  const response1 = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: problem }],
  });

  const text1 = response1.content.find(b => b.type === 'text');
  if (text1 && text1.type === 'text') {
    console.log(text1.text);
  }
  console.log('\nTokens used:', response1.usage.input_tokens + response1.usage.output_tokens);

  console.log('\n\n=== With Extended Thinking ===\n');

  const response2 = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: problem }],
  });

  for (const block of response2.content) {
    if (block.type === 'thinking') {
      console.log('Thinking process:');
      console.log(block.thinking);
      console.log();
    } else if (block.type === 'text') {
      console.log('Answer:');
      console.log(block.text);
    }
  }
  console.log('\nTokens used:', response2.usage.input_tokens + response2.usage.output_tokens);
}

// Example 4: Extended thinking with tools
// IMPORTANT: when continuing a tool-use conversation, pass the assistant's
// thinking blocks back unmodified (signature included) in the message history.
async function extendedThinkingWithTools() {
  const tools: Anthropic.Tool[] = [
    {
      name: 'calculate',
      description: 'Perform mathematical calculations',
      input_schema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate',
          },
        },
        required: ['expression'],
      },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        'Calculate the compound interest on $1000 invested at 5% annual interest for 10 years, compounded monthly',
    },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    tools,
    messages,
  });

  console.log('=== Extended Thinking with Tools ===\n');

  for (const block of response.content) {
    if (block.type === 'thinking') {
      console.log('Planning:');
      console.log(block.thinking);
      console.log();
    } else if (block.type === 'tool_use') {
      console.log('Tool use:', block.name);
      console.log('Parameters:', block.input);
      console.log();
    } else if (block.type === 'text') {
      console.log('Response:');
      console.log(block.text);
    }
  }
}

// Example 5: Common error — budget_tokens >= max_tokens (older models)
async function demonstrateBudgetError() {
  try {
    console.log('=== budget_tokens must be < max_tokens ===\n');

    await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      // Invalid: budget meets/exceeds max_tokens → 400 invalid_request_error
      thinking: { type: 'enabled', budget_tokens: 4096 },
      messages: [
        {
          role: 'user',
          content: 'Solve this complex math problem step by step',
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.log('Expected API error:', error.status, error.message);
      console.log('Fix: keep budget_tokens >= 1024 and strictly below max_tokens,');
      console.log('or switch to a 4.6 model with thinking: { type: "adaptive" }.');
    } else {
      throw error;
    }
  }
}

// Example 6: Check thinking support at runtime via the Models API
// (never hardcode capability tables — they rot; see shared/models.md)
async function modelSupportsThinking(modelId: string): Promise<{
  adaptive: boolean;
  enabled: boolean;
  contextWindow: number;
}> {
  const model = await anthropic.models.retrieve(modelId);
  // `capabilities` is an untyped nested object — check `supported` at the leaf
  const caps = (model as unknown as {
    capabilities?: {
      thinking?: {
        types?: {
          adaptive?: { supported?: boolean };
          enabled?: { supported?: boolean };
        };
      };
    };
    max_input_tokens?: number;
  });

  return {
    adaptive: caps.capabilities?.thinking?.types?.adaptive?.supported ?? false,
    enabled: caps.capabilities?.thinking?.types?.enabled?.supported ?? false,
    contextWindow: caps.max_input_tokens ?? 0,
  };
}

async function validateModelForExtendedThinking(modelId: string): Promise<void> {
  const support = await modelSupportsThinking(modelId);

  if (!support.adaptive && !support.enabled) {
    throw new Error(`Model ${modelId} does not support extended thinking.`);
  }

  const mode = support.adaptive ? 'adaptive' : 'enabled (budget_tokens)';
  console.log(`Model ${modelId} supports extended thinking (${mode})`);
  console.log(`Context window: ${support.contextWindow.toLocaleString()} tokens`);
}

// Run examples
if (require.main === module) {
  console.log('=== Extended Thinking Examples ===\n');

  validateModelForExtendedThinking('claude-sonnet-4-6')
    .then(() => basicExtendedThinking())
    .then(() => {
      console.log('\n\n=== Comparison ===\n');
      return compareThinkingModes();
    })
    .then(() => {
      console.log('\n\n=== Budget Error Demo ===\n');
      return demonstrateBudgetError();
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

export {
  basicExtendedThinking,
  budgetedThinking,
  compareThinkingModes,
  extendedThinkingWithTools,
  demonstrateBudgetError,
  modelSupportsThinking,
  validateModelForExtendedThinking,
};
