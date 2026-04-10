# Breadboard AI, Audit, Trust, And Sync Guidance

## Coach / AI Rules

Breadboard AI should always know the difference between:

- verified exact board behavior
- connector-defined but not fully verified behavior
- heuristic or generic behavior
- real stash readiness vs conceptual design intent

If a change touches prompts, inspector trust copy, or coach actions, keep those distinctions aligned.

## Board Health Rules

Board health is most useful when it is:

- visible from the main workbench
- actionable, not just descriptive
- tied to affected parts or pins
- compatible with selected-part inspection and coach actions

A score without remediation is not enough.

## Sync Rules

Sync work is high risk because silent success can still feel wrong to the user.
Always check:

- did the same net create duplicate breadboard wires?
- can the user tell whether a wire was hand-drawn or synced?
- does selecting a synced part still expose the right trust/readiness state?
- does the UI keep beginner intuition intact, or did it become “smart but spooky”?

## Exact-Part Rules

For verified boards and exact parts:

- preserve trust metadata end-to-end
- never flatten verified exact and heuristic draft states into the same label
- show enough confidence/provenance in the UI that bring-up risk is obvious

## Breadboard Readiness Model

Think about readiness as one blended signal coming from:

- part trust
- stash truth
- layout quality
- board-health issues
- coach coverage

Breadboard changes are strongest when they make that readiness model more visible and more actionable.
