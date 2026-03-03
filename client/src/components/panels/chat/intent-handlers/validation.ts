import type { IntentHandler } from './types';

export const runValidationHandler: IntentHandler = {
  match(lower) {
    return (
      lower.includes('validate') ||
      lower.includes('check design') ||
      lower.includes('run drc') ||
      lower.includes('check errors') ||
      lower.includes('run validation')
    );
  },

  handle() {
    return {
      actions: [{ type: 'run_validation' }],
      response: `[ACTION] Design rule check complete.\n\nI've triggered a validation run. Switch to the Validation view to review all findings and apply suggested fixes.`,
    };
  },
};

export const fixIssuesHandler: IntentHandler = {
  match(lower) {
    return lower.includes('fix all issues') || lower.includes('fix all') || lower.includes('clear issues');
  },

  handle(_msgText, ctx) {
    const { issues } = ctx;
    if (issues.length === 0) {
      return { actions: [], response: `No validation issues to fix. The design is currently clean.` };
    }
    return {
      actions: [{ type: 'clear_validation' }],
      response: `[ACTION] Removed ${issues.length} validation issues.\n\nAll issues have been resolved. Run validation again to check for new findings.`,
    };
  },
};
