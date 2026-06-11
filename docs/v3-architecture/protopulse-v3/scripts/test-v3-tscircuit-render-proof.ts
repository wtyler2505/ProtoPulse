import assert from 'node:assert/strict';
import sample from '../examples/sample-architecture.json';
import { renderTscircuitDraftProof } from '../src/components/circuits/tscircuit-render-proof';

const proof = await renderTscircuitDraftProof(sample.tscircuitDraft);

assert.equal(proof.status, 'rendered');
assert.ok(proof.circuitJsonCount > 0);
assert.ok(proof.circuitJsonTypes.includes('source_project_metadata'));

console.log(JSON.stringify(proof, null, 2));
