#!/bin/bash
# PostToolUse hook: context-budget monitor.
#
# DISABLED 2026-06-23 — deliberately a no-op. Do not re-enable as-is.
#
# WHY: this hook used raw transcript-FILE BYTES as a proxy for context/token
# budget (WARN at 500KB, CRITICAL at 1MB). That proxy is badly wrong on a
# 1M-token model: the transcript .jsonl is bloated with every tool result,
# DOM snapshot, and base64 blob, so ~1MB of transcript ~= ~15% of the real
# token budget and ~2MB ~= ~28%. The old thresholds therefore emitted
# "CRITICAL: ... Context near capacity. Consider new session." for nearly the
# ENTIRE session, at single-digit-to-low-double-digit real usage.
#
# That false signal repeatedly caused the assistant to wrap turns early, punt
# work to "a fresh session," and hand off at ~28% real usage -- exactly the
# behavior Tyler called out (2026-05-09 and again 2026-06-23). Bytes do not
# map reliably to tokens (a screenshot-heavy session bloats bytes fast; a
# text session does not), so there is no honest fixed byte threshold.
#
# The accurate context read already exists: the statusline command
# (~/.claude/scripts/context-monitor.py via ~/.claude/settings.json) tracks
# real token usage per-model and shows e.g. "295k/1M 30%". Use that, or the
# /context command. This byte hook was redundant AND misleading, so it is
# silenced rather than re-thresholded.
#
# To re-enable a context budget warning in the future, base it on actual
# token usage (parse the transcript's usage fields or the statusline payload),
# NOT on stat() of the .jsonl file size.

echo '{}'
exit 0
