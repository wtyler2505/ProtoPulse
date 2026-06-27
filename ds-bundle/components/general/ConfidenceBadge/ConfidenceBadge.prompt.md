ConfidenceBadge from rest-express. Use via `window.ProtoPulse.ConfidenceBadge` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<TooltipProvider>` (full provider chain in README.md — components read theme/i18n from that context).

Displays an AI confidence score as a colored badge with a hover tooltip.

Colors reflect certainty tiers:
- Green (80-100): High confidence
- Yellow (50-79): Medium confidence
- Orange (25-49): Low confidence
- Red (0-24): Very low confidence

The tooltip shows the explanation and contributing factors.
