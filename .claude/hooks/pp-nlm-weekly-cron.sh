#!/usr/bin/env bash
# Weekly Sunday 09:00 — generate audio brief from pp-journal + Briefing Doc summarizing pp-backlog.
set -e
WEEK_OF=$(date -u -d "last monday" +%Y-%m-%d)
nlm login --check || { echo "auth needed"; exit 1; }

nlm audio create pp-journal --format deep_dive --length default \
  --focus "Key ProtoPulse changes during the week of $WEEK_OF" --confirm
sleep 5
nlm report create pp-backlog --format "Briefing Doc" \
  --custom-prompt "Summarize backlog status for week of $WEEK_OF: items moved OPEN→DONE, new BL-XXXX created, blocked items, P0/P1 changes." --confirm
