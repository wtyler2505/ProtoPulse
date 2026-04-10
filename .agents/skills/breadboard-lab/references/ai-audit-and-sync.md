# Breadboard AI, Audit, Trust, And Sync Guidance

## Coach And AI Rules

Breadboard AI should always know the difference between:

- verified exact board behavior
- connector-defined but not fully verified behavior
- heuristic or generic behavior
- real stash readiness versus conceptual design intent

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
- does selecting a synced part still expose the right trust and readiness state?
- does the UI keep beginner intuition intact, or did it become smart but spooky?
