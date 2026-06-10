/**
 * @protopulse/erc — electrical rules. Findings anchor to real entities
 * and carry executable fixes; every code indexes the concepts wiki.
 */
export { runErc } from './run.js';
export { pinPairVerdict, type Verdict } from './matrix.js';
export { compareFindings, type Anchor, type Finding, type Severity } from './findings.js';
export { conceptFor, ERC_CODES, type CodeInfo } from './codes.js';
