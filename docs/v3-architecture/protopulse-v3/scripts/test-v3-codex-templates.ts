import assert from 'node:assert/strict';
import blockedSample from '../examples/sample-swarm.json';
import readySample from '../examples/sample-swarm-ready.json';
import { createCodexCommandTemplates } from '../src/ai/swarms/codex-command-templates';
import { planSwarmDispatch } from '../src/ai/swarms/orchestrator';

const blockedTemplates = createCodexCommandTemplates(planSwarmDispatch(blockedSample.tasks));

assert.equal(blockedTemplates.status, 'blocked');
assert.deepEqual(blockedTemplates.templates, []);

const readyTemplates = createCodexCommandTemplates(planSwarmDispatch(readySample.tasks));

assert.equal(readyTemplates.status, 'ready');
assert.equal(readyTemplates.templates.length, readySample.tasks.length);
assert.equal(readyTemplates.templates[0].argv[0], 'codex');
assert.equal(readyTemplates.templates[0].argv[1], 'exec');
assert.ok(readyTemplates.templates[0].argv.includes('--sandbox'));
assert.ok(readyTemplates.templates[0].argv.includes('workspace-write'));
assert.ok(readyTemplates.templates[0].argv.includes('--output-schema'));

console.log(JSON.stringify({
  blockedStatus: blockedTemplates.status,
  blockedTemplateCount: blockedTemplates.templates.length,
  readyStatus: readyTemplates.status,
  readyTemplateCount: readyTemplates.templates.length,
  firstCommand: readyTemplates.templates[0].command.split(' ').slice(0, 6).join(' '),
}, null, 2));
