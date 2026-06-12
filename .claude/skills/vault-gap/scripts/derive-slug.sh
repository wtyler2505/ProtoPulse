#!/usr/bin/env bash
# derive-slug.sh — Deterministic slug derivation for vault-gap stubs
# (both gap-seeds and --source user suggestions; one derivation = no
# duplicate stubs across queues).
#
# Usage:
#   ./derive-slug.sh "WCAG focus ring contrast"
#   → wcag-focus-ring-contrast
#
#   ./derive-slug.sh "ESP32 GPIO12 must be low at boot"
#   → esp32-gpio12-must-be-low-at-boot
#
# Rules:
#   - lowercase
#   - replace non-alphanumeric with '-'
#   - collapse consecutive dashes
#   - trim leading/trailing dashes
#   - cap at 80 chars, truncate at last word boundary inside cap
#   - reject path-traversal tokens (.., /, \) defensively

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <topic string>" >&2
  exit 2
fi

topic="$*"

# lowercase + non-alphanumeric → dash, collapse dashes, trim.
# The [^a-z0-9]+ reduction already strips '/', '\', '.', so path-traversal
# characters cannot survive into the output slug. We still double-check below.
slug=$(echo "$topic" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g' \
  | sed -E 's/-+/-/g' \
  | sed -E 's/^-+//' \
  | sed -E 's/-+$//')

if [[ -z "$slug" ]]; then
  echo "ERROR: topic produced empty slug" >&2
  exit 4
fi

# Post-derivation sanity check — slug must be alphanumeric + dashes only
if [[ ! "$slug" =~ ^[a-z0-9-]+$ ]]; then
  echo "ERROR: derived slug contains illegal characters: $slug" >&2
  exit 3
fi

# Cap at 80 chars at last word boundary
if [[ ${#slug} -gt 80 ]]; then
  slug="${slug:0:80}"
  # trim to last '-' to avoid mid-word cut
  slug="${slug%-*}"
fi

echo "$slug"
