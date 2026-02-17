# ProtoPulse User Guide

Welcome to **ProtoPulse** — your browser-based, AI-assisted electronics design platform. Whether you're architecting an IoT sensor node, managing a bill of materials for a production run, or validating your design before sending it to fabrication, ProtoPulse brings everything together in one place.

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
3. [Architecture View — Designing Your System](#3-architecture-view--designing-your-system)
   - [The Block Diagram Canvas](#the-block-diagram-canvas)
   - [Adding Components](#adding-components)
   - [Moving and Selecting Components](#moving-and-selecting-components)
   - [Connecting Components](#connecting-components)
   - [Connection Properties](#connection-properties)
   - [Context Menu (Right-Click)](#context-menu-right-click)
   - [The Asset Manager (Component Library)](#the-asset-manager-component-library)
   - [Empty Canvas: Getting Started Quickly](#empty-canvas-getting-started-quickly)
4. [Component Editor — Designing Individual Parts](#4-component-editor--designing-individual-parts)
   - [Breadboard View](#breadboard-view)
   - [Schematic View](#schematic-view)
   - [PCB View](#pcb-view)
   - [Metadata View](#metadata-view)
   - [Pin Table](#pin-table)
   - [Saving Your Work](#saving-your-work)
5. [Procurement View — Bill of Materials Management](#5-procurement-view--bill-of-materials-management)
   - [The BOM Table](#the-bom-table)
   - [Adding Items](#adding-items)
   - [Searching and Filtering](#searching-and-filtering)
   - [Stock Status Indicators](#stock-status-indicators)
   - [Exporting to CSV](#exporting-to-csv)
   - [Cost Optimisation Settings](#cost-optimisation-settings)
   - [Quick Actions on BOM Items](#quick-actions-on-bom-items)
6. [Validation View — Design Rule Checks](#6-validation-view--design-rule-checks)
   - [Running Validation](#running-validation)
   - [Understanding Issues](#understanding-issues)
   - [Resolving and Dismissing Issues](#resolving-and-dismissing-issues)
7. [Output View — System Logs](#7-output-view--system-logs)
   - [Viewing Logs](#viewing-logs)
   - [Filtering and Searching](#filtering-and-searching)
   - [Copying and Clearing Logs](#copying-and-clearing-logs)
8. [Schematic View — Circuit Diagrams](#8-schematic-view--circuit-diagrams)
   - [Navigating the Schematic](#navigating-the-schematic)
   - [Multi-Sheet Support](#multi-sheet-support)
9. [AI Chat Assistant — Your Design Partner](#9-ai-chat-assistant--your-design-partner)
   - [Chatting with the AI](#chatting-with-the-ai)
   - [What the AI Can Do](#what-the-ai-can-do)
   - [Example Prompts to Try](#example-prompts-to-try)
   - [Configuring AI Settings](#configuring-ai-settings)
   - [Action Confirmation](#action-confirmation)
   - [Error Messages](#error-messages)
10. [Themes and Appearance](#10-themes-and-appearance)
11. [Keyboard Shortcuts](#11-keyboard-shortcuts)
12. [Notifications](#12-notifications)
13. [Tips and Best Practices](#13-tips-and-best-practices)
14. [Troubleshooting](#14-troubleshooting)
15. [Glossary](#15-glossary)

---

## 1. Getting Started

### Opening the App

Open ProtoPulse in your browser. The workspace loads immediately with the **Architecture View** open by default, showing your block diagram canvas front and center.

> **Note:** The backend supports user accounts (registration and login via API), but the current version opens directly into the workspace without a login screen. Authentication features are being developed for a future release.

### First Look: The Workspace

You'll see the ProtoPulse workspace — a three-panel layout designed to keep everything you need within reach.

Don't worry if the canvas is empty — you can start adding components right away, or ask the AI assistant to generate an architecture for you.

---

## 2. The Workspace Layout

ProtoPulse uses a clean three-panel layout that you can customise to suit your workflow.

```
┌──────────┬──────────────────────────────┬──────────┐
│          │  Output | Architecture |      │          │
│  Left    │  Component Editor |           │  Right   │
│  Sidebar │  Procurement | Validation     │  Chat    │
│          │                               │  Panel   │
│          │     (Main Content Area)       │          │
│          │                               │          │
└──────────┴──────────────────────────────┴──────────┘
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
| **Output** | View system logs, AI actions, and event history |
| **Architecture** | Design your system block diagram with a drag-and-drop canvas |
| **Component Editor** | Design individual electronic components (breadboard, schematic, PCB, metadata, pin table) |
| **Procurement** | Manage your Bill of Materials (BOM) — parts, pricing, suppliers, stock |
| **Validation** | Run design rule checks and review issues |

Click any tab to switch. The currently active tab is highlighted with a cyan accent bar.

### Right Chat Panel (AI Assistant)

The right panel is home to your AI design assistant. It's always there when you need it — type a question, describe what you want, or ask the AI to modify your design directly.

More on the AI assistant in [Section 9](#9-ai-chat-assistant--your-design-partner).

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

## 3. Architecture View — Designing Your System

The Architecture View is the heart of ProtoPulse. It's where you lay out your system as a **block diagram** — showing which components are in your design and how they connect to each other.

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

## 4. Component Editor — Designing Individual Parts

The Component Editor lets you design and define individual electronic components in detail. It's organised into five sub-views, accessible via tabs at the top of the editor.

### Breadboard View

A visual breadboard representation where you can place and arrange SVG shapes to create a breadboard-style illustration of your component. Use the shape tools to draw rectangles, circles, paths, text, and grouped elements.

This is useful for creating visual documentation of how your component looks when plugged into a breadboard.

### Schematic View

The schematic symbol editor lets you design the schematic representation of your component — the symbol that appears on circuit diagrams. Draw pins, outlines, and labels using the interactive SVG canvas.

### PCB View

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

This data links your component to the architecture diagram, ensuring that connections in the block diagram match the actual pinout of the part.

### Saving Your Work

- Click the **Save** button to save your component to the database.
- A toast notification confirms when your component has been saved successfully.

> **Note:** Undo/redo is not yet available in the Component Editor. Save frequently to avoid losing work.

---

## 5. Procurement View — Bill of Materials Management

The Procurement View is your command centre for managing the Bill of Materials (BOM) — the list of every component you need to build your design, along with pricing, suppliers, and stock information.

### The BOM Table

The BOM is displayed as a full-width table with the following columns:

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

At the top of the view, you'll see the **Estimated BOM Cost** displayed prominently — this is the sum of all line items, shown per unit at 1,000-quantity pricing.

### Adding Items

Click the **"Add Item"** button at the top of the view. A new row will appear in the table with placeholder values that you can edit. You can also add items via the AI assistant — try "Add ESP32-S3-WROOM-1 to the BOM."

### Searching and Filtering

Use the **search bar** at the top to filter the BOM by part number, manufacturer, description, or supplier. The table updates in real time as you type.

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

A notification will confirm when the export is complete.

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

---

## 6. Validation View — Design Rule Checks

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

## 7. Output View — System Logs

The Output View shows a chronological log of everything happening in your project — think of it as the system's activity monitor.

### Viewing Logs

Logs appear in a terminal-style display with green text on a dark background. Each entry is numbered and timestamped. You'll see entries like:

- `[SYSTEM] Initializing ProtoPulse Core...`
- `[PROJECT] Smart_Agro_Node_v1 loaded.`
- `[AI] Added sensor node: BME280`
- `[RESOLVED] Marked resolved: Missing decoupling capacitor`

### Filtering and Searching

Use the **search/filter bar** at the top to narrow down the log. Type any keyword and the log will show only matching entries in real time.

### Copying and Clearing Logs

- **Copy all logs** — Click the copy icon at the top to copy the entire log history to your clipboard. A "Copied" notification will confirm.
- **Clear logs** — Log entries can be managed through the AI chat or API.

The Output view shows up to 500 of the most recent entries. If there are more, a note at the top will indicate how many older entries are hidden.

---

## 8. Schematic View — Circuit Diagrams

The Schematic View provides an interactive circuit schematic viewer where you can explore your design at the circuit level.

### Navigating the Schematic

- **Pan** — Hold the **Space** key and drag to move around the schematic, or use the middle mouse button.
- **Zoom** — Use your scroll wheel to zoom in and out.

### Multi-Sheet Support

The Schematic View supports multiple sheets, reflecting hierarchical designs. Sheet tabs appear below the schematic for switching between different sections of your design.

> **Note:** The Schematic View currently displays demo/reference data. Full interactive schematic capture (placing components, routing wires) is planned for a future phase. You can ask the AI assistant to "generate a schematic" — this feature is under active development.

---

## 9. AI Chat Assistant — Your Design Partner

The AI assistant is one of ProtoPulse's most powerful features. It lives in the right panel and acts as an expert electronics engineer that can both advise you and directly modify your design.

### Chatting with the AI

1. Type your message in the text box at the bottom of the chat panel.
2. Press **Enter** or click the **Send** button.
3. The AI will respond with streaming text — you'll see the words appear in real time.
4. The AI's responses support rich formatting including bold text, bullet points, tables, and more.

Your chat history is saved to the database and persists between sessions, so you can pick up where you left off.

### What the AI Can Do

The AI assistant is far more than a chatbot — it can take direct action on your design. Here's a summary of its capabilities:

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
- Export to KiCad and SPICE formats (planned)
- Record design decisions with rationale

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

## 10. Themes and Appearance

ProtoPulse supports two visual themes:

- **Dark Theme** (default) — A sleek, dark interface with neon cyan and purple accents. Easy on the eyes during long design sessions.
- **Light Theme** — A bright, clean interface for well-lit environments or personal preference.

To switch themes, click the **theme toggle button** in the top-right area of the header bar (next to the chat panel toggle). Your preference is saved automatically.

The interface uses three carefully chosen font families:
- **Rajdhani** — For headings and display text, giving ProtoPulse its distinctive engineering aesthetic
- **JetBrains Mono** — For part numbers, pin names, and technical values — a monospaced font optimised for readability
- **Inter** — For body text and descriptions — clean and highly legible

---

## 11. Keyboard Shortcuts

| Shortcut | Action | Where It Works |
|----------|--------|----------------|
| **Space + Drag** | Pan the canvas | Architecture View, Schematic View |
| **Scroll Wheel** | Zoom in/out | Architecture View, Schematic View |
| **Delete** / **Backspace** | Delete selected node(s) (with confirmation) | Architecture View |
| **Escape** | Close dialog, deselect, dismiss panel | Everywhere |
| **Right-Click** | Open context menu | Architecture View |
| **Enter** | Send message | AI Chat |

---

## 12. Notifications

ProtoPulse uses small **toast notifications** — cards that briefly appear in the bottom-right corner of the screen — to confirm your actions and alert you to important events. You don't need to click them; they disappear automatically after a few seconds.

Common notifications include:

- **"Export Complete"** — Your BOM CSV has been downloaded successfully.
- **"Item Added"** — A new component has been added to the BOM.
- **"Validation Running"** — Design rule checks have been initiated.
- **"Issue Dismissed"** — A validation issue has been marked as resolved.
- **"Saved"** — Your component has been saved to the database.
- **"Copied"** — Content has been copied to your clipboard.
- **"Export Failed"** / **"Save Failed"** — Something went wrong (the notification will include details).

---

## 13. Tips and Best Practices

Here are some recommendations to help you get the most out of ProtoPulse:

### Designing Efficiently

- **Start with the AI.** Describe your project in plain language and let the AI generate a starting architecture. It's much faster than building from scratch, and you can refine from there.
- **Use real part numbers.** The AI knows thousands of real components. Ask it to recommend specific parts — it'll give you actual manufacturer part numbers with specifications.
- **Drag from the library.** The Asset Manager in the Architecture view is the fastest way to add components manually. Search by name to find parts quickly.
- **Right-click for quick actions.** The context menu on nodes and BOM items provides shortcuts for common operations.

### Managing Your BOM

- **Export early, export often.** Use the CSV export to share your BOM with procurement, purchasing teams, or colleagues using other tools.
- **Check stock status.** The colour-coded badges make it easy to spot supply chain problems at a glance. Address "Out of Stock" items early.
- **Ask the AI for alternatives.** If a part is out of stock or too expensive, ask: "Find a cheaper alternative to [part number]" or "What can I use instead of [part]?"

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
3. **Populate the BOM** — ask the AI to add all components with pricing, or add them manually.
4. **Run validation** to catch design issues.
5. **Resolve issues** and iterate on your design.
6. **Export the BOM** as CSV for your procurement team.
7. **Use the Component Editor** to define detailed component specifications if needed.

---

## 14. Troubleshooting

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

If you encounter a problem not listed here, try these general steps:

1. **Refresh the page** — This resolves most temporary issues.
2. **Check your internet connection** — ProtoPulse requires an active connection.
3. **Try a different browser** — Chrome, Firefox, Edge, and Safari are all supported.
4. **Clear your browser cache** — Sometimes stale data can cause display issues.

---

## 15. Glossary

| Term | Definition |
|------|-----------|
| **Architecture** | The high-level system design showing major components and their interconnections as a block diagram. |
| **Asset Manager** | The component library in the Architecture view, where you browse and drag components onto the canvas. |
| **BLE** | Bluetooth Low Energy — a wireless protocol for short-range, low-power communication. |
| **BOM** | Bill of Materials — a complete list of all components needed to build the design, including quantities, pricing, and sourcing. |
| **Bus** | A shared communication pathway connecting multiple components (e.g., SPI bus, I2C bus). |
| **Canvas** | The interactive drawing area where you place and connect components. |
| **CAN** | Controller Area Network — a communication protocol commonly used in automotive and industrial applications. |
| **Component** | An individual electronic part in your design (e.g., microcontroller, resistor, sensor). |
| **Connector** | A physical interface for connecting wires, cables, or other boards (e.g., USB-C, JST header). |
| **CSV** | Comma-Separated Values — a simple spreadsheet file format, widely compatible with Excel and other tools. |
| **DFM** | Design for Manufacturing — guidelines and checks that ensure your design can be manufactured efficiently. |
| **DRC** | Design Rule Check — automated validation that flags potential design problems. |
| **Edge** | A line connecting two components on the architecture diagram, representing an electrical connection. |
| **ESD** | Electrostatic Discharge — a sudden flow of static electricity that can damage components. ESD protection circuits prevent this. |
| **Footprint** | The physical outline and pad pattern of a component on a PCB. |
| **GPIO** | General Purpose Input/Output — configurable digital pins on a microcontroller. |
| **I2C** | Inter-Integrated Circuit — a two-wire serial communication protocol commonly used for sensors. |
| **LDO** | Low Dropout Regulator — a type of voltage regulator that can work with a small difference between input and output voltage. |
| **LoRa** | Long Range — a low-power wireless protocol for IoT devices with ranges of several kilometres. |
| **MCU** | Microcontroller Unit — a small computer on a single chip (e.g., ESP32, STM32, ATmega). |
| **MPN** | Manufacturer Part Number — the unique identifier assigned to a part by its manufacturer. |
| **Net** | A named electrical connection in a schematic (e.g., VCC, GND, MOSI). |
| **Node** | A component block on the architecture diagram. |
| **PCB** | Printed Circuit Board — the physical board that holds and connects electronic components. |
| **Pin** | A connection point on a component (e.g., power pin, signal pin, ground pin). |
| **Schematic** | A diagram showing the electrical connections between components using standardised symbols. |
| **SMD** | Surface-Mount Device — a component designed to be soldered directly onto the surface of a PCB. |
| **SPI** | Serial Peripheral Interface — a high-speed, four-wire serial communication protocol. |
| **THT** | Through-Hole Technology — components with wire leads that pass through holes in the PCB. |
| **Toast** | A brief notification message that appears temporarily on screen. |
| **UART** | Universal Asynchronous Receiver/Transmitter — a serial communication protocol commonly used for debugging. |
| **USB** | Universal Serial Bus — a standard for data transfer and power delivery. |
| **Validation** | The process of checking your design for errors, warnings, and improvement opportunities. |

---

*Thank you for choosing ProtoPulse. Happy designing!*
