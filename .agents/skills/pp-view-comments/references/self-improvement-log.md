# Comments Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so Comments work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real Comments behavior.

## Pending Proposals

- Add screenshots for the main Comments states.
- Add more specific gotchas after the next real Comments implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin `SKILL.md` only.

---

## 2026-05 Deep Analysis Pass (user: "/pp-view-comments" in the systematic full-app views backlog campaign)

**Workflow followed exactly:**
1. Inspector run → ok (CommentsPanel 501 LOC — moderate complexity for a threaded comments system with anchoring).
2. page-map.md read (single panel file, used both standalone in workspace and potentially embedded).
3. ux-contract.md read (emphasis on visibility of Discussion, Review Notes, Anchors, Resolved State, and especially Source Trust for AI-generated comments).
4. testing.md read (zero tests recorded for the panel).
5. gotchas.md read.
6. This entry + contribution to master backlog report.

**Deep Findings:**

**What the Panel Actually Delivers:**
- Threaded discussion system (`DesignComment` with parentId).
- Rich targeting: general, node, edge, bom_item, and 'spatial' (with x/y + view: architecture/schematic/pcb/breadboard).
- Status workflow: open, resolved, blocked, wontfix + reopen.
- Filtering by resolved state and target type.
- Create / reply / change status / delete with proper invalidation.
- Relative timestamps, target badges, visual distinction for closed comments.

**Biggest Gaps vs. UX Contract:**
- **"Anchors" visibility** is only partially solved. Spatial comments (especially from PCB) are created with rich context, but the central panel has no dedicated filter or clear display for `spatialView` / coordinates. They likely just appear under "node/edge" or get lost in "general".
- **"Source Trust" for AI-generated comments** is called out in the contract but has zero visible surface. If Eve (AI) can leave review comments, there is no badge or indication of AI origin vs. human.
- **Resolved State** workflow is present but the panel doesn't strongly surface "why was this blocked/wontfix?" or link back to the originating discussion.

**Other Notable Items:**
- No tests for the panel itself (despite being a core collaboration feature).
- Real-time updates are missing (only 30s staleTime + manual invalidation on mutations). In a multi-user or AI-heavy workflow this will feel stale.
- The targetFilter in the panel UI does not yet expose 'spatial' as a first-class option, even though the backend and PCB creation fully support it.
- Performance with deep threading or hundreds of comments on large projects is untested.
- Integration with AI/Chat is latent but powerful (Eve leaving structured review comments on architecture nodes, BOM items, or spatial locations on PCB would be extremely valuable).

**Durable Lesson:**
A comments system in a design tool lives or dies by the quality of its **anchoring** and **provenance**. When the contract calls out "Anchors" and "Source Trust" as first-class, the implementation must make it trivial for a user to see *exactly what* a comment is attached to and *who* (or what AI) wrote it. Spatial anchoring across multiple views (pcb, schematic, architecture, breadboard) is a sophisticated feature that is currently under-served by the central panel's filtering and display.

**Recommended for Codex:**
- Expose 'spatial' as a first-class target filter in the panel, and render spatial context (which view + approximate location) on spatial comments.
- Add visible "AI-generated" / trust badges on comments (especially if Eve can create them).
- Improve the anchoring creation UX from ArchitectureView, SchematicView, and Breadboard (currently only strong in PCB).
- Add tests for the panel (threading, filtering, status workflow, spatial rendering).
- Consider lightweight real-time (or at least optimistic updates + better invalidation strategy).
- Make "Apply to Design" or "Jump to Anchor" from a comment one-click where possible (especially powerful when combined with the new 3D bridge).

This analysis is contributed to the living master backlog report. The Comments panel is a solid foundation with sophisticated backend support (spatial anchoring across four views!), but the UI surfaces for anchors and source trust are still incomplete relative to the power of the system and the explicit requirements in its own UX contract.

## R20 A11y Gate Guard

- The broad `p1-a11y-scan` gate caught a critical `button-name` defect on the icon-only compose submit button and a serious contrast defect in the shortcut hint.
- Add/keep `client/src/components/panels/__tests__/CommentsPanel.test.tsx` as the focused guard for accessible compose controls.
- When compacting the Comments panel, do not shrink text contrast below the a11y gate's serious threshold; secondary hints still need readable contrast on `bg-zinc-950`.

## R21 Spatial Anchor Visibility

- PCB can create `targetType: spatial` comments with `spatialView: pcb` and canvas coordinates, but the central Comments panel previously hid that context behind a generic target badge.
- Keep `spatial` exposed as a target filter and render the originating canvas plus coordinates on the comment item.
- Future canvas-comment work should build on this same shape for Schematic, Breadboard, Architecture, and 3D anchors instead of adding view-specific comment side channels.
