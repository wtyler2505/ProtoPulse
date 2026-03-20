# The "Prompt-to-Printer" Workflow (ProtoPulse)

## The Vision
A fully autonomous pipeline where a natural language prompt results in physical plastic extruding from a 3D printer, orchestrated entirely by Google Genkit, Gemini ER, and local toolchains.

## The Architecture Pipeline

### 1. Spatial Conception (The "Brain")
*   **Trigger:** User asks, *"I need a mount for an HC-SR04 ultrasonic sensor to attach to a 20mm aluminum extrusion on my rover."*
*   **Model:** `gemini-robotics-er-1.5-preview`
*   **Action:** The ER model analyzes the physical constraints. It determines the exact distance between the sensor's "eyes" (approx 43mm), the diameter of the cylinders, and the required clamp geometry to grip a 2020 aluminum extrusion. It calculates tolerances and structural weak points.

### 2. Code-to-CAD Generation (The "Draftsman")
*   **Model:** `gemini-3.1-pro-preview-customtools`
*   **Action:** Genkit takes the mathematical constraints from the ER model and asks Gemini Pro to write an **OpenSCAD** script. OpenSCAD is a programming language for 3D modeling. AI models are exceptionally good at writing code, making OpenSCAD the perfect bridge between LLM text and 3D geometry.
*   **Output:** A `.scad` file containing the parametric 3D model.

### 3. Native Compilation (The "Forge")
*   **Tool:** `compile_openscad` (Custom Genkit Tool)
*   **Action:** Because ProtoPulse is now a native desktop application, it has full access to the host machine's shell. Genkit executes the local OpenSCAD CLI:
    `openscad -o sensor_mount.stl sensor_mount.scad`
*   **Output:** A perfect, watertight `.stl` 3D model file.

### 4. Autonomous Slicing (The "Machinist")
*   **Tool:** `slice_to_gcode` (Custom Genkit Tool)
*   **Action:** Genkit reasons about the physical requirements. Since it's a rover mount, it needs strength. It autonomously selects a 40% gyroid infill and PETG settings. It executes a local slicer (like PrusaSlicer or CuraEngine CLI):
    `prusa-slicer --gcode --infill 40% --layer-height 0.2 --material PETG sensor_mount.stl`
*   **Output:** The machine instructions (`sensor_mount.gcode`).

### 5. Over-The-Air Execution (The "Operator")
*   **Tool:** `send_to_printer` (Custom Genkit Tool)
*   **Action:** Using a local network connection, Genkit hits your 3D printer's API (OctoPrint, Klipper/Moonraker, or Bambu Network). 
    It uploads the G-code and sends the `start_print` command.
*   **Result:** The printer bed heats up. The plastic flows.

### 6. Cloud Archive (The "Archivist")
*   **Tool:** `workspace-developer` (Google Drive API)
*   **Action:** Genkit takes the `.scad` source code, the `.stl` file, and the final `.gcode`, zips them up, and uploads them directly to your Google Drive "ProtoPulse 3D Assets" folder for permanent backup and future iterations.

## Why this is possible NOW:
1. **Genkit:** Can perfectly orchestrate the handover between the ER model (spatial math), the Pro model (coding), and the local shell (compiling).
2. **Native Desktop:** ProtoPulse isn't restricted by a browser sandbox anymore. It can run CLI tools (OpenSCAD, Slic3r).
3. **Local Network:** The app can talk directly to your OctoPrint/Klipper local IP address.
