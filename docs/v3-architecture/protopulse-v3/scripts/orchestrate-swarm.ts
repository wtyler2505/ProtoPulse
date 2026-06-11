import { readFile } from 'node:fs/promises';
import { planSwarmDispatch } from '../src/ai/swarms/orchestrator';

const manifestPath = process.argv[2];
const manifest = manifestPath
  ? JSON.parse(await readFile(manifestPath, 'utf8')) as { tasks?: unknown[] }
  : { tasks: [] };

const plan = planSwarmDispatch(manifest.tasks ?? []);

console.log(JSON.stringify(plan, null, 2));
