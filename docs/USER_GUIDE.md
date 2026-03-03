# ProtoPulse User Guide

Welcome to **ProtoPulse** — your browser-based, AI-assisted electronics design platform. Whether you're architecting an IoT sensor node, capturing a schematic, managing a bill of materials for a production run, or validating your design before sending it to fabrication, ProtoPulse brings everything together in one place.

This guide will walk you through every feature in detail so you can get the most out of the platform.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
   - [Opening the App](#opening-the-app)
   - [First Look: The Workspace](#first-look-the-workspace)
2. [The Workspace Layout](#2-the-workspace-layout)
   - [Left Sidebar](#left-sidebar)
   - [Center Main Area](#center-main-area)
   - [Right Chat Panel (AI Assistant)](#right-chat-panel-ai-assistant)
   - [Collapsing and Resizing Panels](#collapsing-and-resizing-panels)
   - [Mobile Layout](#mobile-layout)
3. [Dashboard View — Project Overview](#3-dashboard-view--project-overview)
   - [Quick Stats Bar](#quick-stats-bar)
   - [Summary Cards](#summary-cards)
   - [Welcome Overlay (New Projects)](#welcome-overlay-new-projects)
4. [Architecture View — Designing Your System](#4-architecture-view--designing-your-system)
   - [The Block Diagram Canvas](#the-block-diagram-canvas)
   - [Adding Components](#adding-components)
   - [Moving and Selecting Components](#moving-and-selecting-components)
   - [Connecting Components](#connecting-components)
   - [Connection Properties](#connection-properties)
   - [Context Menu (Right-Click)](#context-menu-right-click)
   - [The Asset Manager (Component Library)](#the-asset-manager-component-library)
   - [Empty Canvas: Getting Started Quickly](#empty-canvas-getting-started-quickly)
5. [Schematic View — Full Circuit Capture Editor](#5-schematic-view--full-circuit-capture-editor)
   - [The Schematic Canvas](#the-schematic-canvas)
   - [The Schematic Toolbar](#the-schematic-toolbar)
   - [Placing Components](#placing-components)
   - [Connecting Pins with Net Drawing Tool](#connecting-pins-with-net-drawing-tool)
   - [Power Symbols and Net Labels](#power-symbols-and-net-labels)
   - [No-Connect Markers](#no-connect-markers)
   - [Grid Snap and Coordinate Readout](#grid-snap-and-coordinate-readout)
   - [ERC Panel — Electrical Rule Check](#erc-panel--electrical-rule-check)
   - [Net Class Panel](#net-class-panel)
   - [Hierarchical Sheet Panel](#hierarchical-sheet-panel)
   - [Breadboard View](#breadboard-view)
   - [PCB Layout View](#pcb-layout-view)
6. [Component Editor — Designing Individual Parts](#6-component-editor--designing-individual-parts)
   - [Breadboard View (Component Editor)](#breadboard-view-component-editor)
   - [Schematic Symbol View](#schematic-symbol-view)
   - [PCB Footprint View](#pcb-footprint-view)
   - [Metadata View](#metadata-view)
   - [Pin Table](#pin-table)
   - [Saving Your Work](#saving-your-work)
7. [Procurement View — Bill of Materials Management](#7-procurement-view--bill-of-materials-management)
   - [BOM Management Tab](#bom-management-tab)
   - [Adding Items](#adding-items)
   - [Searching and Filtering](#searching-and-filtering)
   - [Stock Status Indicators](#stock-status-indicators)
   - [Exporting to CSV](#exporting-to-csv)
   - [Cost Optimisation Settings](#cost-optimisation-settings)
   - [Quick Actions on BOM Items](#quick-actions-on-bom-items)
   - [BOM Comparison Tab](#bom-comparison-tab)
8. [Validation View — Design Rule Checks](#8-validation-view--design-rule-checks)
   - [Running Validation](#running-validation)
   - [Understanding Issues](#understanding-issues)
   - [Resolving and Dismissing Issues](#resolving-and-dismissing-issues)
9. [Output View — Exports](#9-output-view--exports)
   - [Export Formats](#export-formats)
   - [Downloading Exports](#downloading-exports)
10. [Simulation — Circuit Analysis](#10-simulation--circuit-analysis)
    - [SPICE Simulation Panel](#spice-simulation-panel)
    - [Frequency Analysis Panel](#frequency-analysis-panel)
11. [AI Chat Assistant — Your Design Partner](#11-ai-chat-assistant--your-design-partner)
    - [Chatting with the AI](#chatting-with-the-ai)
    - [What the AI Can Do](#what-the-ai-can-do)
    - [Example Prompts to Try](#example-prompts-to-try)
    - [Configuring AI Settings](#configuring-ai-settings)
    - [Action Confirmation](#action-confirmation)
    - [Error Messages](#error-messages)
12. [Command Palette](#12-command-palette)
13. [Themes and Appearance](#13-themes-and-appearance)
14. [Keyboard Shortcuts](#14-keyboard-shortcuts)
15. [Notifications](#15-notifications)
16. [Tips and Best Practices](#16-tips-and-best-practices)
17. [Troubleshooting](#17-troubleshooting)
18. [Glossary](#18-glossary)

---

## 1. Getting Started

### Opening the App

Open ProtoPulse in your browser. The workspace loads immediately with the **Dashboard View** open by default, giving you an instant overview of your project.

> **Note:** The backend supports user accounts (registration and login via API). The current version opens directly into the workspace without a login screen. Authentication features are available via the API.

### First Look: The Workspace

You'll see the ProtoPulse workspace — a three-panel layout designed to keep everything you need within reach.

If this is a new project, a **Welcome Overlay** will appear with quick-start options. You can dismiss it at any time and it won't appear again.

---

## 2. The Workspace Layout

ProtoPulse uses a clean three-panel layout that you can customise to suit your workflow.

```
┌──────────┬─────────────────────────────────────────┬──────────┐
│          │  Dashboard | Architecture | Schematic |  │          │
│  Left    │  Component Editor | Procurement |        │  Right   │
│  Sidebar │  Validation | Exports | Simulation       │  Chat    │
│          │                                          │  Panel   │
│          │           (Main Content Area)            │          │
└──────────┴─────────────────────────────────────────┴──────────┘
```

### Left Sidebar

The left sidebar gives you quick access to:

- **Project Name and Description** — Displayed at the top. You can rename your project via the AI assistant or project settings.
- **Component Library (Asset Manager)** — Browse components by category (MCU, Sensor, Power, Communication, Connector, Memory, Actuator). Drag them onto the Architecture canvas to add them to your design.
- **Project History** — A chronological log of actions taken on the project, including who did what (you or the AI).

### Center Main Area

The center area is where the real work happens. A row of **tabs** across the top lets you switch between views:

| Tab | What It Does |
|-----|-------------|
| **Dashboard** | Project overview with stats, summaries, and recent activity |
| **Architecture** | Design your system block diagram with a drag-and-drop canvas |
| **Schematic** | Full circuit schematic capture editor with ERC, net classes, breadboard, and PCB layout |
| **Component Editor** | Design individual electronic components (breadboard, schematic symbol, PCB footprint, metadata, pin table) |
| **Procurement** | Manage your Bill of Materials (BOM) — parts, pricing, suppliers, stock, and BOM snapshots |
| **Validation** | Run design rule checks and review issues |
| **Exports** | Download your design in multiple formats (KiCad, Eagle, SPICE, Gerber, BOM, PDF, and more) |
| **Simulation** | SPICE circuit simulation and frequency response analysis with Bode plot visualisation |

Click any tab to switch. The currently active tab is highlighted with a cyan accent bar.

### Right Chat Panel (AI Assistant)

The right panel is home to your AI design assistant. It's always there when you need it — type a question, describe what you want, or ask the AI to modify your design directly.

More on the AI assistant in [Section 11](#11-ai-chat-assistant--your-design-partner).

### Collapsing and Resizing Panels

Both the left sidebar and the right chat panel can be:

- **Collapsed** — Click the panel toggle buttons in the top tab bar (the small panel icons on the left and right ends of the tab row). This hides the panel entirely, giving you more room for the main content.
- **Resized** — Drag the thin divider bar between panels to make them wider or narrower. The sidebar can range from 180 px to 480 px wide; the chat panel from 280 px to 600 px.

### Mobile Layout

On phones and tablets, the layout adapts automatically:

- The **left sidebar** becomes a slide-out menu, accessible via the **hamburger menu** button (three lines) in the top-left corner.
- The **main tabs** move to a **bottom navigation bar** with icons for each view.
- The **AI chat** is accessible via the **chat bubble** button in the top-right corner of the header.

Everything works the same — it's just rearranged to fit smaller screens.

---

## 3. Dashboard View — Project Overview

The Dashboard View provides an at-a-glance summary of your entire project. It is the default view when you open ProtoPulse.

### Quick Stats Bar

A row of stat pills at the top of the dashboard shows key metrics at a glance:

- **Components** — Number of architecture nodes in the block diagram
- **Connections** — Number of edges between architecture nodes
- **BOM Items** — Number of unique parts in the Bill of Materials
- **Est. Cost** — Estimated total BOM cost in USD
- **Issues** — Count of open validation issues (red if errors, yellow if warnings, green if all clear)

### Summary Cards

Four summary cards provide deeper information, each clickable to navigate directly to the corresponding view:

- **Architecture Card** — Shows node count, edge count, connection density, and a breakdown of node types (MCU, Sensor, Power, etc.)
- **Bill of Materials Card** — Shows total quantity, unique part count, estimated cost, and stock status breakdown (In Stock, Low Stock, Out of Stock, On Order)
- **Validation Card** — Shows overall pass/fail status and a breakdown of errors, warnings, and informational notices
- **Recent Activity Card** — Shows the last 5 history entries (timestamped, with user or AI attribution)

### Welcome Overlay (New Projects)

On first launch with an empty project, a Welcome Overlay appears with quick-start options:

- Start the AI-guided onboarding flow
- Jump directly to Architecture view to begin designing
- Browse the component library

Dismiss the overlay at any time using the close button. Once dismissed, it will not reappear unless you reset the browser's local storage.

---

## 4. Architecture View — Designing Your System

The Architecture View is where you lay out your system as a **block diagram** — showing which components are in your design and how they connect to each other.

### The Block Diagram Canvas

The canvas is an interactive, zoomable workspace. Each block on the canvas represents a component in your design (a microcontroller, a sensor, a power regulator, etc.), and lines between blocks represent electrical connections (SPI buses, I2C lines, power rails, and so on).

### Adding Components

There are several ways to add components to your architecture:

1. **Drag from the Asset Manager** — Open the Asset Manager (component library panel on the left side of the Architecture view) and drag a component onto the canvas. Components are organised by category:
   - **MCU** — Microcontrollers (ESP32, STM32, ATmega, etc.)
   - **Sensor** — Temperature, humidity, accelerometer, GPS, etc.
   - **Power** — Voltage regulators, battery chargers, DC-DC converters
   - **Communication** — LoRa, Wi-Fi, BLE, Zigbee modules
   - **Connector** — USB-C, headers, JST connectors
   - **Memory** — Flash, EEPROM, SRAM, SD card
   - **Actuator** — Motors, LEDs, relays, buzzers

2. **Right-click the canvas** — Choose **Add Component** from the context menu, then select a category.

3. **Ask the AI** — Type something like "Add an ESP32-S3 microcontroller" in the chat panel, and the AI will place it on the canvas for you.

4. **Use the component library** — Browse the Asset Manager in the left sidebar to find and drag components onto the canvas.

### Moving and Selecting Components

- **Click** a component to select it. The selected node gets a highlighted border.
- **Drag** a component to reposition it on the canvas.
- **Click an empty area** of the canvas to deselect everything.
- Components align neatly on the canvas for clean layouts.

### Connecting Components

To create a connection (edge) between two components:

1. Hover over a component until you see a connection handle (a small dot on the edge of the block).
2. Click and drag from that handle to another component.
3. Release to create the connection.

A line will appear between the two components, representing an electrical connection. Connected lines animate gently to show they're active.

### Connection Properties

Each connection can carry metadata about the type of signal or bus it represents:

- **Signal Type** — SPI, I2C, UART, USB, Power, GPIO, CAN, Ethernet, and more
- **Voltage** — e.g., 3.3V, 5V, 12V
- **Bus Width** — e.g., 4-bit, 8-bit
- **Net Name** — A custom label for the net (e.g., MOSI, SDA, VCC_3V3)

The AI assistant can set these properties when creating connections. For example: "Connect the ESP32 to the SHT40 via I2C at 3.3V."

### Context Menu (Right-Click)

Right-click anywhere on the canvas to access quick actions:

- **Add Component** — Choose from MCU, Sensor, Power, Communication, or Connector categories
- **Paste** — Paste a previously copied component
- **Fit View** — Zoom to fit all components in the visible area
- **Toggle Grid** — Turn snap-to-grid on or off
- **Select All** — Select every component on the canvas
- **Export to Clipboard** — Copy the entire architecture data to your clipboard

### The Asset Manager (Component Library)

The Asset Manager is a searchable library of electronic components, displayed as a panel on the left side of the Architecture canvas. It includes:

- A **search bar** at the top to filter components by name
- **Category tabs** to browse by type (MCU, Sensor, Power, Communication, Connector, Memory, Actuator)
- **Component cards** that you can drag directly onto the canvas or click to add

### Empty Canvas: Getting Started Quickly

When the canvas is empty, you'll see a helpful prompt with a large **"Generate Architecture"** button. Click it, and the AI will create a sample block diagram to get you started — complete with an MCU, power management, communication module, and sensor, all wired together.

You can also type a description in the chat panel, like:

> "Design an IoT weather station with an ESP32, BME280 sensor, LoRa module, and solar charging"

The AI will generate a complete architecture tailored to your description.

---

## 5. Schematic View — Full Circuit Capture Editor

The Schematic View is a fully interactive circuit schematic capture editor. It supports real component instances, net connections with waypoints, power symbols, net labels, no-connect markers, ERC checking, net class management, multi-sheet hierarchical designs, and more.

The Schematic view is accessed via the **Schematic** tab. Inside it, additional sub-views are accessible via a secondary tab bar: **Schematic** (the canvas editor), **Breadboard**, and **PCB Layout**.

### The Schematic Canvas

The canvas uses @xyflow/react as its foundation and is backed by real circuit data in the database. Instances, nets, and wires persist between sessions.

- **Pan** — Hold the **H** key (Pan tool) or use the middle mouse button to drag the canvas
- **Zoom** — Use your scroll wheel to zoom in and out
- **Fit View** — Press **F** or click the Fit View button in the toolbar
- **Coordinate Readout** — A live X/Y coordinate display appears in the bottom-right corner as you move your mouse

### The Schematic Toolbar

The toolbar along the top of the schematic canvas provides tool selection and view controls:

| Tool | Shortcut | Function |
|------|----------|---------|
| **Select** | V | Select and drag components or nets |
| **Pan** | H | Pan the canvas without selecting |
| **Draw Net** | W | Draw net connections between component pins |
| **Toggle Snap** | G | Enable or disable grid snapping |
| **Fit View** | F | Zoom to show all components |
| **Shortcuts** | ? | Open the keyboard shortcuts dialog |

A MiniMap in the bottom-right of the canvas provides a bird's-eye view of the full schematic.

### Placing Components

Components from your Component Library (those you have created in the Component Editor) can be placed on the schematic canvas:

1. Drag a component from the **Components panel** in the schematic sidebar onto the canvas.
2. ProtoPulse automatically assigns a **reference designator** (e.g., U1, R3, C5) based on the component's family type (IEC/IEEE standard prefixes).
3. The component appears as a schematic symbol using the shapes defined in its Schematic Symbol View in the Component Editor.

Power symbols (VCC, GND, +3V3, +5V, VBAT, etc.) can be dragged from the **Power Symbols panel** and placed on the canvas. They persist in the circuit design settings.

### Connecting Pins with Net Drawing Tool

The Net Drawing Tool (shortcut **W**) lets you draw wire connections between component pins with Manhattan (orthogonal) routing:

1. Activate the Net Drawing Tool by pressing **W** or clicking the draw-net button in the toolbar.
2. Click on a component pin (the small handle dot on the symbol edge) to begin drawing.
3. Click on the canvas to add waypoints — the wire routes horizontally then vertically between each point.
4. Click on a target pin to complete the net connection.
5. Press **Escape** to cancel, or **Backspace** to undo the last waypoint.

When a connection is completed, a net is created in the database with a human-readable name derived from the reference designators and pin names (e.g., `U1.SDA_U2.SDA`).

You can also create simple connections by dragging directly from one pin handle to another without using the draw-net tool — this creates a straight net edge.

Individual net edges can be deleted by selecting them and pressing **Delete** or **Backspace**. If all segments of a net are deleted, the net is removed entirely.

### Power Symbols and Net Labels

**Power symbols** represent power rails (VCC, GND, etc.) and appear as standard schematic power symbols. Available types include VCC, GND, +3V3, +5V, VBAT, and custom labels.

**Net labels** allow you to name a node in the schematic without drawing a physical wire to it. Nets with the same label name are electrically connected, which is standard practice in multi-sheet designs.

Both power symbols and net labels are draggable and their positions persist to the database.

### No-Connect Markers

No-connect markers (X symbols) can be placed on pins that intentionally have no connection. This suppresses ERC warnings for unconnected pins that you have deliberately left unconnected.

### Grid Snap and Coordinate Readout

- Grid snap is enabled by default. Toggle it with **G** or the snap button in the toolbar.
- The default grid size is configurable per circuit design via the circuit settings.
- A coordinate readout in the bottom-right shows your current canvas position in flow coordinates.

### ERC Panel — Electrical Rule Check

The **ERC Panel** is accessible from the schematic view's side panel. It runs a set of electrical rule checks on your circuit and reports violations grouped by rule type.

**Available ERC rules:**

| Rule | Default Severity | What It Checks |
|------|-----------------|---------------|
| Unconnected Pin | Warning | Pins with no connection and no no-connect marker |
| Shorted Power | Error | Two or more power nets connected together |
| Floating Input | Warning | Input pins with no driving source |
| Missing Bypass Cap | Warning | Power pins without a nearby decoupling capacitor |
| Driver Conflict | Error | Multiple output drivers connected to the same net |
| No-Connect Connected | Warning | A no-connect marker that has a net connected to it |
| Power Net Unnamed | Warning | Power nets that have not been named |

**Using the ERC Panel:**

1. Click the **Run** button in the ERC Panel header to run all enabled checks.
2. Violations are displayed grouped by rule type with expandable sections.
3. A summary bar shows the total error and warning counts.
4. Click any violation to pan and zoom the canvas to the affected location.
5. Click the settings icon to open the rule configuration panel, where you can enable/disable individual rules or toggle their severity between error and warning.

When no violations are found, a green "No violations found" message is displayed.

### Net Class Panel

The **Net Class Panel** allows you to define groups of nets with shared PCB trace properties. This information is used when exporting to KiCad and other PCB formats.

**Net class properties:**

- **Name** — Identifies the class (e.g., Power, High-Speed, Signal)
- **Trace Width** — Minimum copper trace width in mm
- **Clearance** — Minimum clearance between traces in mm
- **Via Diameter** — Minimum via diameter in mm
- **Color** — A visual colour indicator shown in the panel

**Using the Net Class Panel:**

1. The **Default** net class applies to all nets that have not been explicitly assigned.
2. Click **Add** to create a new net class with custom properties.
3. In the **Net Assignments** section, use the dropdown next to each net name to assign it to a class.
4. Hover over any class entry to reveal Edit and Delete buttons.
5. The Default class cannot be deleted.

> **Note:** Net class assignments are currently stored in local session state and are not persisted to the database. This is planned for a future update.

### Hierarchical Sheet Panel

The **Hierarchical Sheet Panel** shows all circuit designs (sheets) in your project as a list. Click any sheet to switch the schematic canvas to that circuit design.

- Each sheet is identified by its circuit design name and description.
- Sheet numbers are shown for reference.
- When multiple sheets exist, a note indicates that inter-sheet connectivity (global labels, sheet ports) is planned for a future update.

### Breadboard View

The **Breadboard View** (accessible via the secondary tab inside the Schematic view) shows your circuit on an interactive solderless breadboard. It is useful for prototyping and visual communication of your layout.

**Features:**

- A standard 830-tie-point breadboard grid with power rails
- **Select tool (1)** — Select and pan the canvas
- **Wire tool (2)** — Draw wire connections between breadboard tie-points
- **Delete tool (3)** — Delete selected wires
- Zoom controls (zoom in/out, reset)
- Tie-point highlighting on hover
- Coordinate readout showing board position
- A **ratsnest overlay** shows unrouted net connections as thin dashed lines, helping you understand which tie-points need to be wired together
- Wire colours are assigned per net automatically

**Drawing wires:**

1. Activate the Wire tool by pressing **2** or clicking the Pencil icon.
2. Click a tie-point to start a wire.
3. Click additional tie-points to add waypoints.
4. Double-click to finish and commit the wire to the database.
5. Press **Escape** to cancel a wire in progress.
6. Click a wire to select it, then press **Delete** or **Backspace** to remove it.

A circuit design selector at the top lets you switch between multiple circuit designs in the same project.

### PCB Layout View

The **PCB Layout View** (accessible via the secondary tab inside the Schematic view) provides a basic PCB component placement and trace routing editor.

**Features:**

- Configurable board outline (width and height in mm, default 50 x 40 mm)
- Dot grid at 0.5 mm spacing (50 mil)
- **Select tool (1)** — Select and pan the canvas
- **Trace tool (2)** — Route copper traces between pads with grid snap
- **Delete tool (3)** — Delete selected traces
- **Front/Back layer toggle (F)** — Switch between F.Cu (front copper, red) and B.Cu (back copper, blue)
- Trace width presets: 0.15, 0.25, 0.5, 1.0, 2.0 mm, plus a continuous slider
- A **ratsnest overlay** shows unrouted net connections as thin dashed lines
- Layer legend in the bottom-left corner
- Coordinate readout showing board position in mm
- Component footprints shown as labelled rectangles (simplified placeholder footprints)

**Routing traces:**

1. Activate the Trace tool by pressing **2** or clicking the Pencil icon.
2. Click on the canvas to place trace points (snapped to the 0.5 mm grid).
3. Double-click to finish routing and commit the trace.
4. Press **Escape** to cancel a trace in progress.
5. Click a trace to select it, then press **Delete** or **Backspace** to remove it.
6. Press **F** to toggle between front and back copper layers.

---

## 6. Component Editor — Designing Individual Parts

The Component Editor lets you design and define individual electronic components in detail. It is organised into five sub-views, accessible via tabs at the top of the editor.

### Breadboard View (Component Editor)

A visual breadboard representation where you can place and arrange SVG shapes to create a breadboard-style illustration of your component. Use the shape tools to draw rectangles, circles, paths, text, and grouped elements.

This is useful for creating visual documentation of how your component looks when plugged into a breadboard.

### Schematic Symbol View

The schematic symbol editor lets you design the schematic representation of your component — the symbol that appears on circuit diagrams. Draw pins, outlines, and labels using the interactive SVG canvas.

The shapes you define here are rendered on the Schematic Canvas when an instance of this component is placed.

### PCB Footprint View

The PCB footprint editor is where you define the physical footprint of your component — the copper pads, silkscreen outline, and courtyard that will appear on your printed circuit board.

### Metadata View

The Metadata View is where you fill in all the essential information about your component:

| Field | Description | Example |
|-------|-------------|---------|
| **Title** | Component name | ATmega328P |
| **Family** | Component family | AVR |
| **Description** | Brief description of the part | 8-bit microcontroller with 32KB flash |
| **Manufacturer** | Who makes it | Microchip |
| **MPN** | Manufacturer Part Number | ATMEGA328P-AU |
| **Mounting Type** | THT (through-hole), SMD (surface mount), or Other | SMD |
| **Package Type** | Physical package | TQFP-32 |
| **Tags** | Comma-separated keywords for searchability | mcu, microcontroller, avr, 8-bit |

### Pin Table

The Pin Table is where you define every pin/connector on your component:

- Pin names and numbers
- Pad specifications (THT or SMD)
- Terminal positions
- Electrical function (power, signal, ground, etc.)

This data is used to render pin handles on the Schematic Canvas, enabling you to draw net connections between component pins.

### Saving Your Work

- Click the **Save** button to save your component to the database.
- A toast notification confirms when your component has been saved successfully.

> **Note:** Undo/redo is not yet available in the Component Editor. Save frequently to avoid losing work.

---

## 7. Procurement View — Bill of Materials Management

The Procurement View is your command centre for managing the Bill of Materials (BOM). It has two tabs: **BOM Management** and **BOM Comparison**.

### BOM Management Tab

The BOM is displayed as a full-width virtualised table (rows are rendered on demand for performance) with the following columns:

| Column | Description |
|--------|-------------|
| **Status** | Stock availability (In Stock, Low Stock, Out of Stock) |
| **Part Number** | The manufacturer's part number |
| **Manufacturer** | Who makes the component |
| **Description** | What the component is |
| **Supplier** | Where to buy it (Digi-Key, Mouser, LCSC) |
| **Stock** | Number of units available at the supplier |
| **Qty** | How many you need |
| **Unit Price** | Cost per unit |
| **Total** | Quantity multiplied by unit price |
| **Actions** | Quick action buttons (buy, delete) |

At the top of the view, you'll see the **Estimated BOM Cost** displayed prominently — this is the sum of all line items.

BOM rows support **drag-and-drop reordering** using the grip handle on the left side of each row. Your custom order is saved to local storage.

You can also **inline-edit** any BOM row by clicking directly on a cell (part number, description, quantity, unit price, etc.). Changes save automatically when you press Enter or click elsewhere.

### Adding Items

Click the **"Add Item"** button at the top of the view. A dialog will appear where you can fill in the part details. You can also add items via the AI assistant — try "Add ESP32-S3-WROOM-1 to the BOM."

### Searching and Filtering

Use the **search bar** at the top to filter the BOM by part number, manufacturer, description, or supplier. The table updates in real time as you type.

Click the column headers to **sort** the BOM by that column in ascending or descending order.

### Stock Status Indicators

Each BOM item shows a clear stock status badge:

- **In Stock** — Green badge with a checkmark icon. This part is readily available.
- **Low Stock** — Yellow badge with an alert icon. Stock is limited; consider ordering soon.
- **Out of Stock** — Red badge with an X icon. This part is currently unavailable. You may need to find an alternative.

These colour-coded badges are designed to be immediately recognisable at a glance, with icons alongside text for accessibility.

### Exporting to CSV

Click the **"Export CSV"** button to download your entire BOM as a spreadsheet file. This is perfect for:

- Sharing with your procurement team
- Importing into other tools (Excel, Google Sheets, ERP systems)
- Archiving your BOM at a specific design milestone

For advanced export options including BOM in multiple formats, see the [Exports section](#9-output-view--exports).

### Cost Optimisation Settings

Click the **"Cost Optimisation"** button to reveal advanced settings:

- **Production Batch Size** — Set your target production quantity (up to 10,000 units). Pricing often varies significantly with volume.
- **Max BOM Cost Target** — Set a per-unit cost ceiling. Useful for keeping designs within budget.
- **Sourcing Constraints:**
  - **In Stock Only** — Toggle this on to filter out components that aren't currently available.
  - **Preferred Suppliers** — Choose which distributors to prioritise (Mouser, Digi-Key, LCSC). Click "Edit List" to check or uncheck suppliers.
- **Optimization Goal** — Choose what matters most for your project:
  - **Cost** — Minimise total BOM cost
  - **Power** — Minimise power consumption
  - **Size** — Minimise board footprint
  - **Avail** — Maximise component availability

### Quick Actions on BOM Items

Hover over any row to reveal action buttons:

- **Shopping cart icon** — Opens the supplier's website with your part number pre-filled, so you can purchase directly.
- **Trash icon** — Remove this item from the BOM (you'll be asked to confirm before deletion).

Right-click any BOM row for additional options:

- **Copy Details** — Copy the full part details to your clipboard
- **Search Datasheet** — Open a web search for the part's datasheet
- **Find Alternatives** — Search for equivalent or alternative parts
- **Buy from [Supplier]** — Go directly to the supplier's product page
- **Copy Part Number** — Copy just the part number
- **Remove from BOM** — Delete this item

### BOM Comparison Tab

The **BOM Comparison** tab (second tab in the Procurement view) allows you to compare the current BOM against a previously saved snapshot. This is useful for tracking design changes over time, reviewing what changed between hardware revisions, and auditing cost impact.

**Taking a snapshot:**

1. Click **"Take Snapshot"** in the BOM Comparison tab header.
2. Enter a descriptive label (e.g., "Rev A", "Before power supply change").
3. Click **Create Snapshot**. The current BOM state is saved to the database.

**Comparing against a snapshot:**

1. Use the snapshot dropdown selector to choose a previously saved snapshot.
2. ProtoPulse computes a diff between the snapshot and the current BOM automatically.
3. A **summary bar** shows the count of added, removed, and modified items, plus the total cost delta in USD.
4. A **diff table** lists every changed item with colour-coded badges:
   - **Green (Added)** — Parts present now that were not in the snapshot
   - **Red (Removed)** — Parts in the snapshot that have since been removed
   - **Yellow (Modified)** — Parts present in both, but with changed fields (quantity, price, supplier, etc.)

**Managing snapshots:**

- Click the **trash icon** next to a selected snapshot to delete it.
- Snapshots are stored per-project and persist between sessions.

---

## 8. Validation View — Design Rule Checks

The Validation View helps you catch potential problems in your design before you commit to fabrication. Think of it as a spell-checker for your electronics design.

### Running Validation

Click the **"Run DRC Checks"** button at the top of the view. ProtoPulse will analyse your design and flag potential issues. A notification will confirm that validation is running.

You can also ask the AI assistant to run validation: just type "Run validation" or "Check my design" in the chat.

### Understanding Issues

Each validation issue is displayed as a card with:

- **Severity icon** — Colour-coded to indicate urgency:
  - **Red (Error)** — A critical problem that must be fixed. For example: "SPI bus contention possible without proper CS management."
  - **Yellow (Warning)** — A potential problem worth investigating. For example: "No ESD protection on USB-C data lines."
  - **Blue (Info)** — A suggestion or best practice. For example: "Consider adding watchdog timer configuration."
- **Description** — A clear explanation of the issue.
- **Component reference** — Which component or part of the design is affected.
- **Suggestion** — A recommended fix or improvement, shown in green text.

### Resolving and Dismissing Issues

For each issue, you have two options:

- **Mark Resolved** — Click this button (visible when you hover over the issue) to indicate that you've addressed the problem. The issue will be removed from the list, and a notification will confirm the action.
- **Dismiss** — Right-click the issue and select "Dismiss Issue." You'll be asked to confirm, since dismissing removes the issue without verifying that the underlying problem has been fixed.

You can also right-click any issue for additional options:

- **View in Architecture** — Jump to the Architecture view to see the affected component in context.
- **Copy Issue Details** — Copy the issue description to your clipboard.

When all issues are resolved, you'll see a reassuring **"All Systems Nominal"** message with a green checkmark.

---

## 9. Output View — Exports

The Exports view (labelled **Exports** in the tab bar, internally the Output view) provides a full suite of multi-format export capabilities for your design. All export formats are fully implemented and available.

### Export Formats

Exports are organised into four categories:

**Schematic & Netlist:**

| Format | Extension | Description |
|--------|-----------|-------------|
| KiCad Project | .kicad_sch / .kicad_pcb / .kicad_pro | Full KiCad project bundle (schematic + PCB + project file) |
| Eagle Project | .sch / .brd (XML) | Autodesk Eagle schematic and board files |
| SPICE Netlist | .cir | Circuit simulation netlist for LTspice, ngspice, etc. |
| Netlist (CSV) | .csv | Connectivity netlist in CSV format |
| Netlist (KiCad) | .net | Connectivity netlist in KiCad S-expression format |

**PCB Fabrication:**

| Format | Extension | Description |
|--------|-----------|-------------|
| Gerber + Drill | .gbr / .drl (RS-274X + Excellon) | Manufacturing files: copper layers, solder mask, silkscreen, drill |
| Pick-and-Place | .csv | SMT assembly placement file with X/Y coordinates and rotation |

**Documentation & BOM:**

| Format | Extension | Description |
|--------|-----------|-------------|
| BOM (CSV) | .csv | Bill of materials with part numbers, quantities, and pricing |
| Fritzing Project | .fzz | Full Fritzing project archive |
| Design Report (PDF) | .pdf | Comprehensive design report with architecture, BOM, validation, and circuits |
| FMEA Report | .csv | Failure Mode and Effects Analysis with risk priority numbers |

**Firmware:**

| Format | Extension | Description |
|--------|-----------|-------------|
| Firmware Scaffold | .cpp / .h / .ini | Arduino/PlatformIO starter code generated from your architecture |

### Downloading Exports

Each export format is displayed as a card within its category. Click the **Download** button on any format card to generate and download the file. Multi-file formats (KiCad, Eagle, Gerber, Firmware) are downloaded as a ZIP archive.

- A loading spinner shows while the file is being generated on the server.
- A green checkmark confirms a successful download.
- A red error indicator (with a retry option) appears if generation fails.
- Log entries are written to the Output log for each export operation.

---

## 10. Simulation — Circuit Analysis

The Simulation view provides tools for analysing circuit behaviour before physical prototyping.

### SPICE Simulation Panel

The SPICE simulation panel allows you to run transient, AC, and DC sweep analyses on your circuit using a built-in circuit solver. Enter component values, select an analysis type, and view waveform results.

### Frequency Analysis Panel

The **Frequency Analysis Panel** computes the frequency response (Bode plot) of passive filter circuits entirely in the browser — no server round-trip required.

**Supported filter topologies:**

| Topology | Description |
|----------|-------------|
| RC Low-Pass | First-order RC low-pass filter |
| RC High-Pass | First-order RC high-pass filter |
| RLC Band-Pass | Second-order RLC band-pass filter |
| RLC Low-Pass | Second-order RLC low-pass filter |
| Generic 2nd Order | Parametric second-order filter (specify ω₀ and ζ) |

**How to use:**

1. Navigate to the Simulation tab and select Frequency Analysis.
2. Choose a **filter topology** from the selector.
3. Enter the required **component values**. Values support SI unit suffixes: k (kilo), M (mega), m (milli), u (micro), n (nano). For example: 1k, 100n, 10M.
4. Set the **frequency range** (minimum and maximum frequency in Hz).
5. Click **Analyze** to run the computation.
6. The results display a **Bode plot** with magnitude (dB) and phase (degrees) vs. frequency.
7. A **summary panel** shows key metrics: DC gain, -3 dB cutoff frequency, resonant frequency, phase margin, and gain margin (where applicable).
8. Click **Reset** to clear results and start fresh.

The analysis runs at 50 points per decade across the specified frequency range.

---

## 11. AI Chat Assistant — Your Design Partner

The AI assistant is one of ProtoPulse's most powerful features. It lives in the right panel and acts as an expert electronics engineer that can both advise you and directly modify your design.

### Chatting with the AI

1. Type your message in the text box at the bottom of the chat panel.
2. Press **Enter** or click the **Send** button.
3. The AI will respond with streaming text — you'll see the words appear in real time.
4. The AI's responses support rich formatting including bold text, bullet points, tables, and more.

Your chat history is saved to the database and persists between sessions, so you can pick up where you left off.

### What the AI Can Do

The AI assistant is far more than a chatbot — it can take direct action on your design across approximately 80 distinct action types. Here's a summary of its capabilities:

**Architecture Design:**
- Add, remove, and update components on the block diagram
- Create connections between components with proper bus types (SPI, I2C, UART, etc.)
- Generate complete system architectures from a text description
- Clear the canvas and start fresh
- Auto-layout components using different algorithms (hierarchical, grid, circular, force-directed)

**BOM Management:**
- Add, remove, and update BOM items with real part numbers, pricing, and supplier info
- Export the BOM as a CSV file
- Optimise the BOM for cost, suggesting alternative parts and volume pricing
- Check lead times and availability across distributors

**Design Validation:**
- Run design rule checks
- Add custom validation issues and suggestions
- Clear all validation issues
- Perform specialised checks: power budget analysis, voltage domain verification, DFM checks, thermal analysis

**Circuit and Schematic:**
- Create and manage circuit designs (sheets)
- Place and connect schematic instances
- Manage net names and net types
- Navigate to schematic sheets

**Project Management:**
- Rename the project
- Update the project description
- Switch between views
- Navigate to specific schematic sheets

**Advanced Electronics Features:**
- Suggest alternative components based on cost, availability, or performance
- Perform parametric component searches
- Assign net names and pin mappings
- Create sub-circuit templates (power supply, USB interface, SPI flash, etc.)
- Generate design reports
- Export to KiCad, Eagle, SPICE, Gerber, and other formats
- Record design decisions with rationale
- Generate firmware scaffold code

### Example Prompts to Try

Here are some things you can ask the AI — these are great starting points:

**Generating Architectures:**
- "Design an IoT weather station with ESP32, BME280 sensor, and LoRa module"
- "Create a battery-powered BLE beacon with solar charging"
- "Generate a motor controller board with STM32 and dual H-bridge"

**Component Recommendations:**
- "What MCU would you recommend for a low-power wearable with BLE?"
- "Suggest a good LDO for converting 5V to 3.3V at 500mA"
- "Compare ESP32-S3 vs nRF52840 for a BLE mesh application"

**Modifying the Design:**
- "Add an SD card module connected via SPI"
- "Remove the LoRa module and replace it with a Wi-Fi module"
- "Connect the temperature sensor to the MCU via I2C"

**BOM and Procurement:**
- "Add all components to the BOM with Digi-Key pricing"
- "Export the BOM as CSV"
- "Find a cheaper alternative to the TPS63020"

**Validation and Analysis:**
- "Run a design rule check"
- "Analyse the power budget for this design"
- "What ESD protection do I need for the USB-C port?"

**Export:**
- "Export to KiCad"
- "Generate a SPICE netlist"
- "Create a firmware scaffold for this design"

**General Electronics Questions:**
- "What pull-up resistor value should I use for I2C at 400kHz?"
- "Explain the difference between buck and boost converters"
- "What's the best antenna type for 915MHz LoRa?"

**Quick Commands:**
- "Switch to procurement view"
- "Rename project to Smart_Greenhouse_v2"
- "Show project summary"
- "Help" — shows a full list of available commands

### Configuring AI Settings

Click the **settings icon** (gear) in the chat panel header to access AI configuration:

- **AI Provider** — Choose between **Anthropic Claude** and **Google Gemini**. Each provider has different strengths; try both to see which you prefer.
- **Model** — Select or type the specific model name (e.g., claude-3-5-sonnet, gemini-pro).
- **API Key** — Enter your API key for the selected provider. Your key is stored encrypted on the server and never exposed in the browser. You need to provide your own API key to use the AI features.
- **Temperature** — Controls creativity vs. precision (0 = very precise and deterministic, 2 = very creative and varied). A value of 0.7 is a good default for electronics design work.
- **Max Tokens** — Controls the maximum length of AI responses (256–16,384 tokens). Higher values allow longer, more detailed responses.
- **Custom System Prompt** — Add your own instructions that the AI will follow. For example: "Always suggest components available from LCSC" or "Prefer STM32 MCUs over ESP32."

The mode indicator at the top of the chat shows which AI provider and model are currently active.

### Action Confirmation

When the AI wants to perform a **destructive action** — like clearing all nodes, removing components, or clearing validation issues — it will show a **confirmation dialog** before proceeding. You'll see exactly what the AI intends to do and can choose to approve or cancel.

This safeguard ensures the AI never makes unwanted changes to your design without your consent.

### Error Messages

If something goes wrong with the AI, you'll see a clear, helpful error message:

| Error | What It Means | What to Do |
|-------|--------------|------------|
| "Authentication failed. Please check your API key" | Your API key is invalid or expired | Go to chat settings and re-enter your API key |
| "Rate limit exceeded" | You've made too many requests in a short time | Wait a minute and try again |
| "Request timed out" | The AI took too long to respond | Try again with a shorter or simpler message |
| "The AI provider is experiencing issues" | The AI service itself is having problems | Wait a few minutes and try again |

---

## 12. Command Palette

The **Command Palette** provides quick keyboard-driven access to navigate between views and run common actions without lifting your hands from the keyboard.

**Opening the Command Palette:**

Press **Ctrl+K** (or **Cmd+K** on macOS) to open the command palette from anywhere in the app.

**Using the Command Palette:**

1. Start typing to search across available commands. The list filters in real time.
2. Use **arrow keys** to navigate the list.
3. Press **Enter** to execute the highlighted command.
4. Press **Escape** to close without executing.

**Available command groups:**

| Group | Commands |
|-------|---------|
| **Navigate** | Architecture, Schematic, PCB Layout, Breadboard, Component Editor, Procurement, Validation, Exports, Simulation |
| **Panels** | Show/Hide Sidebar, Show/Hide AI Assistant |
| **Actions** | Run Design Rule Check, Export Project |

Each navigation command also shows its numeric shortcut (1 through 9) for direct tab access.

---

## 13. Themes and Appearance

ProtoPulse supports two visual themes:

- **Dark Theme** (default) — A sleek, dark interface with neon cyan and purple accents. Easy on the eyes during long design sessions.
- **Light Theme** — A bright, clean interface for well-lit environments or personal preference.

To switch themes, click the **theme toggle button** in the top-right area of the header bar (next to the chat panel toggle). Your preference is saved automatically.

A **high-contrast mode** is available for improved accessibility. Toggle it in the display settings area.

The interface uses three carefully chosen font families:
- **Rajdhani** — For headings and display text, giving ProtoPulse its distinctive engineering aesthetic
- **JetBrains Mono** — For part numbers, pin names, and technical values — a monospaced font optimised for readability
- **Inter** — For body text and descriptions — clean and highly legible

---

## 14. Keyboard Shortcuts

Press **?** at any time to open the full keyboard shortcuts dialog. Below is a summary.

### Global

| Shortcut | Action |
|----------|--------|
| **Ctrl+K** | Open command palette |
| **?** | Open keyboard shortcuts dialog |

### Architecture View

| Shortcut | Action |
|----------|--------|
| **Ctrl+Z** | Undo |
| **Ctrl+Y** / **Ctrl+Shift+Z** | Redo |
| **Delete** / **Backspace** | Delete selected node(s) |
| **Ctrl+A** | Select all nodes |
| **Ctrl+V** | Paste |
| **F** | Fit view |
| **G** | Toggle snap grid |
| **Space + Drag** | Pan the canvas |
| **Scroll Wheel** | Zoom in/out |
| **Right-Click** | Open context menu |
| **Escape** | Deselect / close dialog |

### Schematic View

| Shortcut | Action |
|----------|--------|
| **V** | Select tool |
| **H** | Pan tool |
| **W** | Draw net/wire tool |
| **G** | Toggle snap |
| **F** | Fit view |
| **Escape** | Cancel / deselect |
| **Backspace** | Undo last waypoint (while drawing net) |

### Component Editor

| Shortcut | Action |
|----------|--------|
| **S** | Select tool |
| **R** | Rectangle tool |
| **C** | Circle tool |
| **T** | Text tool |
| **L** | Line tool |
| **P** | Pin tool |
| **M** | Measure tool |
| **B** | Path (Bezier) tool |
| **Delete** / **Backspace** | Delete selected |
| **Ctrl+C** | Copy |
| **Ctrl+V** | Paste |
| **Ctrl+0** / **Home** | Zoom to fit |
| **Ctrl+S** | Save |
| **Ctrl+Z** | Undo |
| **Ctrl+Y** / **Ctrl+Shift+Z** | Redo |
| **Space** | Pan canvas |
| **Enter** | Finish path |
| **Escape** | Cancel path |

### Breadboard View

| Shortcut | Action |
|----------|--------|
| **1** | Select tool |
| **2** | Wire tool |
| **3** | Delete tool |
| **Delete** / **Backspace** | Delete selected wire |
| **Escape** | Cancel / deselect |

### PCB Layout View

| Shortcut | Action |
|----------|--------|
| **1** | Select tool |
| **2** | Trace tool |
| **3** | Delete tool |
| **F** | Flip active layer (front/back) |
| **Delete** / **Backspace** | Delete selected trace |
| **Escape** | Cancel / deselect |

### AI Chat Panel

| Shortcut | Action |
|----------|--------|
| **Enter** | Send message |
| **Escape** | Close panel |

---

## 15. Notifications

ProtoPulse uses small **toast notifications** — cards that briefly appear in the bottom-right corner of the screen — to confirm your actions and alert you to important events. You don't need to click them; they disappear automatically after a few seconds.

Common notifications include:

- **"Export Complete"** — Your file has been downloaded successfully.
- **"Snapshot created"** — A BOM snapshot has been saved.
- **"Item Added"** — A new component has been added to the BOM.
- **"Validation Running"** — Design rule checks have been initiated.
- **"Issue Dismissed"** — A validation issue has been marked as resolved.
- **"Saved"** — Your component has been saved to the database.
- **"Copied"** — Content has been copied to your clipboard.
- **"Reordered"** — BOM item order has been updated.
- **"Export Failed"** / **"Save Failed"** — Something went wrong (the notification will include details).

---

## 16. Tips and Best Practices

Here are some recommendations to help you get the most out of ProtoPulse:

### Designing Efficiently

- **Start with the AI.** Describe your project in plain language and let the AI generate a starting architecture. It's much faster than building from scratch, and you can refine from there.
- **Use real part numbers.** The AI knows thousands of real components. Ask it to recommend specific parts — it'll give you actual manufacturer part numbers with specifications.
- **Drag from the library.** The Asset Manager in the Architecture view is the fastest way to add components manually. Search by name to find parts quickly.
- **Right-click for quick actions.** The context menu on nodes and BOM items provides shortcuts for common operations.
- **Use the Command Palette (Ctrl+K).** Navigate between views and run common actions without touching the mouse.

### Managing Your BOM

- **Take snapshots before major changes.** Use the BOM Comparison tab to save a snapshot before a design revision. This gives you a clear diff of what changed and what it cost.
- **Export early, export often.** Use the CSV export to share your BOM with procurement, purchasing teams, or colleagues using other tools.
- **Check stock status.** The colour-coded badges make it easy to spot supply chain problems at a glance. Address "Out of Stock" items early.
- **Ask the AI for alternatives.** If a part is out of stock or too expensive, ask: "Find a cheaper alternative to [part number]" or "What can I use instead of [part]?"

### Schematic Capture

- **Assign net classes early.** Before routing the PCB, define net classes for power, high-speed signals, and general signal lines. This ensures KiCad exports include your design rules.
- **Use power symbols instead of wires for power rails.** Placing GND and VCC power symbols is cleaner and less error-prone than drawing wires across the sheet.
- **Run ERC regularly.** Click Run in the ERC Panel after placing components to catch unconnected pins and other issues before they compound.
- **Use the Net Drawing Tool (W) for precise routing.** Click to add waypoints for orthogonal wiring — cleaner than free-hand dragging.

### Validating Your Design

- **Run validation before finalising.** Click "Run DRC Checks" regularly to catch problems early. It's much cheaper to fix issues in the design phase than after fabrication.
- **Read the suggestions.** Each validation issue includes a suggested fix — these are based on real-world best practices.
- **Don't just dismiss issues.** If you dismiss a warning, make sure you understand why it was flagged. Some issues (like missing ESD protection) can lead to product failures in the field.

### Working with the AI

- **Be specific.** "Add a temperature sensor" is good, but "Add an SHT40 temperature and humidity sensor connected to the MCU via I2C" is better.
- **Ask for explanations.** The AI can explain trade-offs, compare components, and teach you about design concepts. Don't hesitate to ask "why."
- **Use it for documentation.** Ask the AI to generate a project summary, explain your design decisions, or create a design report.
- **Try different providers.** Anthropic Claude and Google Gemini have different strengths. If one isn't giving you the results you want, try the other.

### General Workflow

1. **Describe your project** to the AI and let it generate an architecture.
2. **Refine the design** by adding, removing, and reconnecting components.
3. **Capture the schematic** in the Schematic view with real component instances and net connections.
4. **Populate the BOM** — ask the AI to add all components with pricing, or add them manually.
5. **Run ERC** in the Schematic view to catch electrical rule violations.
6. **Run DRC** in the Validation view to catch system-level design issues.
7. **Resolve issues** and iterate on your design.
8. **Take a BOM snapshot** before major changes, to track deltas.
9. **Export** in the format you need (KiCad, Gerber, BOM CSV, PDF report, firmware scaffold).

---

## 17. Troubleshooting

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| "Invalid credentials" error | Incorrect username or password when authenticating via API | Double-check your credentials. Passwords are case-sensitive. |
| "Authentication failed. Please check your API key" | Invalid, expired, or missing AI provider API key | Open AI chat settings (gear icon) and re-enter your API key for the selected provider. |
| "Rate limit exceeded" | Too many AI requests in a short period | Wait 30–60 seconds, then try again. Consider reducing your request frequency. |
| AI not responding | No API key configured, or the provider is down | Check that an API key is entered in chat settings. Try switching to a different AI provider. |
| Blank or white screen | Browser rendering issue | Refresh the page (F5 or Ctrl+R). If the problem persists, try clearing your browser cache. |
| Canvas not rendering | View failed to initialise | Switch to a different tab and then switch back. If that doesn't work, refresh the page. |
| Components not appearing after drag | Drop occurred outside the canvas area | Make sure you're dragging the component onto the canvas area (the dotted grid background). |
| BOM export not downloading | Browser blocking the download | Check your browser's download settings. Some browsers require you to allow downloads from the site. |
| Changes not saving | Network connection issue | Check your internet connection. ProtoPulse saves changes automatically, but needs a connection to do so. |
| Chat history missing | Page was loaded before data finished syncing | Wait for the page to fully load. Chat history is persisted to the database and should appear after initial sync. |
| Schematic components not showing | No components in Component Library | Create components in the Component Editor first, then place instances on the Schematic canvas. |
| Net class assignments lost after refresh | Net classes use local session state | Net class persistence to the database is planned for a future update. |

If you encounter a problem not listed here, try these general steps:

1. **Refresh the page** — This resolves most temporary issues.
2. **Check your internet connection** — ProtoPulse requires an active connection.
3. **Try a different browser** — Chrome, Firefox, Edge, and Safari are all supported.
4. **Clear your browser cache** — Sometimes stale data can cause display issues.

---

## 18. Glossary

| Term | Definition |
|------|-----------|
| **Architecture** | The high-level system design showing major components and their interconnections as a block diagram. |
| **Asset Manager** | The component library in the Architecture view, where you browse and drag components onto the canvas. |
| **BLE** | Bluetooth Low Energy — a wireless protocol for short-range, low-power communication. |
| **BOM** | Bill of Materials — a complete list of all components needed to build the design, including quantities, pricing, and sourcing. |
| **BOM Snapshot** | A point-in-time copy of the BOM saved for future comparison. Used in the BOM Comparison tab. |
| **Bode Plot** | A graph showing gain (dB) and phase (degrees) vs. frequency for a circuit, used in frequency response analysis. |
| **Bus** | A shared communication pathway connecting multiple components (e.g., SPI bus, I2C bus). |
| **Canvas** | The interactive drawing area where you place and connect components. |
| **CAN** | Controller Area Network — a communication protocol commonly used in automotive and industrial applications. |
| **Command Palette** | A keyboard-driven search interface (Ctrl+K) for navigating views and executing commands. |
| **Component** | An individual electronic part in your design (e.g., microcontroller, resistor, sensor). |
| **Connector** | A physical interface for connecting wires, cables, or other boards (e.g., USB-C, JST header). |
| **CSV** | Comma-Separated Values — a simple spreadsheet file format, widely compatible with Excel and other tools. |
| **DFM** | Design for Manufacturing — guidelines and checks that ensure your design can be manufactured efficiently. |
| **DRC** | Design Rule Check — automated validation that flags potential design problems. |
| **Edge** | A line connecting two components on the architecture diagram, representing an electrical connection. |
| **ERC** | Electrical Rule Check — a set of checks run on the schematic to identify electrical errors and warnings. |
| **ESD** | Electrostatic Discharge — a sudden flow of static electricity that can damage components. ESD protection circuits prevent this. |
| **FMEA** | Failure Mode and Effects Analysis — a systematic method for evaluating potential failure modes and their impact. |
| **Footprint** | The physical outline and pad pattern of a component on a PCB. |
| **Gerber** | The industry-standard file format for PCB fabrication (RS-274X). Includes separate files for copper layers, solder mask, and silkscreen. |
| **GPIO** | General Purpose Input/Output — configurable digital pins on a microcontroller. |
| **I2C** | Inter-Integrated Circuit — a two-wire serial communication protocol commonly used for sensors. |
| **LDO** | Low Dropout Regulator — a type of voltage regulator that can work with a small difference between input and output voltage. |
| **LoRa** | Long Range — a low-power wireless protocol for IoT devices with ranges of several kilometres. |
| **MCU** | Microcontroller Unit — a small computer on a single chip (e.g., ESP32, STM32, ATmega). |
| **MPN** | Manufacturer Part Number — the unique identifier assigned to a part by its manufacturer. |
| **Net** | A named electrical connection in a schematic (e.g., VCC, GND, MOSI). |
| **Net Class** | A group of nets that share PCB trace width, clearance, and via diameter properties. |
| **No-Connect** | A marker placed on a pin to indicate it is intentionally unconnected, suppressing ERC warnings. |
| **Node** | A component block on the architecture diagram. |
| **PCB** | Printed Circuit Board — the physical board that holds and connects electronic components. |
| **Pick-and-Place** | A file listing component XY coordinates and rotation angles for SMT assembly machines. |
| **Pin** | A connection point on a component (e.g., power pin, signal pin, ground pin). |
| **Ratsnest** | Thin lines on the breadboard or PCB canvas showing unrouted net connections between pads. |
| **Reference Designator** | A standard label identifying a component on a schematic (e.g., U1, R3, C5, J2). |
| **Schematic** | A diagram showing the electrical connections between components using standardised symbols. |
| **SMD** | Surface-Mount Device — a component designed to be soldered directly onto the surface of a PCB. |
| **SPICE** | Simulation Program with Integrated Circuit Emphasis — a standard format for circuit simulation netlists. |
| **SPI** | Serial Peripheral Interface — a high-speed, four-wire serial communication protocol. |
| **THT** | Through-Hole Technology — components with wire leads that pass through holes in the PCB. |
| **Toast** | A brief notification message that appears temporarily on screen. |
| **UART** | Universal Asynchronous Receiver/Transmitter — a serial communication protocol commonly used for debugging. |
| **USB** | Universal Serial Bus — a standard for data transfer and power delivery. |
| **Validation** | The process of checking your design for errors, warnings, and improvement opportunities. |

---

*Thank you for choosing ProtoPulse. Happy designing!*
