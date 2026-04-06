---
description: The Arduino CLI MCP server provides 16 tools for board management, library installation, compilation, upload, and serial monitoring directly from Claude Code
type: claim
source: "MCP tool list, docs/arduino-ide-integration-spec.md"
confidence: proven
topics: ["[[dev-infrastructure]]", "[[eda-fundamentals]]"]
related_components: ["docs/arduino-ide-integration-spec.md", "docs/arduino-ide-api-contracts.md"]
---

# Arduino CLI MCP bridges software development and hardware programming

The Arduino CLI MCP server exposes 16 tools that cover the complete firmware development lifecycle without leaving Claude Code: `list` (connected boards), `board_options` (configuration), `install_board` (platform support), `search_library` / `install_library` / `uninstall_library` / `list_libraries` / `auto_install_libs` (dependency management), `library_examples` / `load_example` (learning), `check` / `compile` (build verification), `upload` (deploy to hardware), `monitor` (serial output), and `diagnose_error` (build failure analysis).

This directly serves ProtoPulse's mission as "the tool you reach for regardless of what you're building." The Arduino integration means a maker can go from circuit schematic to compiled firmware to serial monitoring in a single tool. The `diagnose_error` tool is particularly significant for the target audience (learners without formal EE background) -- it translates cryptic compiler errors into actionable guidance.

The MCP server depends on the Arduino CLI binary being installed on the local system. Since ProtoPulse has pivoted to a native desktop application, this dependency is acceptable -- the native platform provides direct USB/serial access that the browser-based architecture could not. The server supports 5 Arduino-specific database tables (arduino_workspaces, arduino_build_profiles, arduino_jobs, arduino_serial_sessions, arduino_sketch_files) that persist build state across sessions.

---

Relevant Notes:
- [[native-desktop-pivot-unblocked-three-c5-programs]] -- why native access matters for hardware tools
- [[makers-need-one-tool-because-context-switching-kills-momentum]] -- the UX rationale for integrated hardware support

Topics:
- [[dev-infrastructure]]
- [[eda-fundamentals]]
