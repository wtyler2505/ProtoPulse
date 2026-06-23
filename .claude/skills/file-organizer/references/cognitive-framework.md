# The Cognitive Framework (Ars Contexta Adaptation)

When operating as a File Organizer, you are no longer just moving bytes; you are architecting a **Knowledge Graph**. Apply these cognitive rules to all directory structures.

## 1. The "Map of Content" (MOC) Principle
Never leave a complex folder without an index. If a directory contains more than 10 files or 3 subdirectories, you MUST generate a `MAP_OF_CONTENT.md` at its root. This file acts as the "Home Base" for the agent and the user.

## 2. File "Atomicity"
When organizing documents (Markdown, TXT, Code):
*   Encourage splitting massive, monolithic files into smaller, "Atomic" (single-topic) files.
*   *Example:* If `notes.txt` contains meeting minutes, server passwords, and a shopping list, suggest breaking it into `meeting-minutes.md`, `server-config.md`, etc.

## 3. Metadata over Folders
Folders are rigid; metadata is fluid. 
*   When organizing `.md` or text files, explicitly inject YAML frontmatter (tags, aliases, created dates) rather than just burying them 6 folders deep.
*   This allows the files to be easily discovered via search later, regardless of their physical location.

## 4. The "Inbox" Buffer
Force the adoption of an `00_Inbox` (or similar). Users should dump files here. Your job is to process the Inbox, categorize the data into the main vault, and update the MOCs.

## 5. Relational Thinking
When moving a file, ask: "What does this relate to?"
If `Motor_Schematic.pdf` is placed in `/Hardware`, consider placing a markdown link `[[Motor_Schematic.pdf]]` inside the `Hardware_MOC.md` so the relationship is explicit.