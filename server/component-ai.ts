import { GoogleGenAI } from "@google/genai";
import type {
  PartState,
  PartMeta,
  Connector,
  Shape,
  ViewData,
  PartViews,
  Bus,
  Constraint,
  ShapeStyle,
  PadSpec,
  TerminalPosition,
  PartProperty,
} from "@shared/component-types";
import { LRUClientCache } from "./lib/lru-cache";
import { redactSecrets } from "./ai";

// ---------------------------------------------------------------------------
// Client cache (LRU, shared from server/lib/lru-cache.ts)
// ---------------------------------------------------------------------------

const MAX_CLIENT_CACHE = 10;

const genaiClients = new LRUClientCache<GoogleGenAI>(MAX_CLIENT_CACHE);

function getGenAIClient(apiKey: string): GoogleGenAI {
  let client = genaiClients.get(apiKey);
  if (!client) {
    client = new GoogleGenAI({ apiKey });
    genaiClients.set(apiKey, client);
  }
  return client;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Temperature for structured output tasks (part generation, modification,
 * metadata extraction, pin extraction). Lower temperature produces more
 * deterministic, schema-conformant JSON.
 */
const STRUCTURED_TEMPERATURE = 0.3;

/**
 * Temperature for creative/prose tasks (description suggestions).
 */
const CREATIVE_TEMPERATURE = 0.7;

const MAX_OUTPUT_TOKENS = 8192;

// ---------------------------------------------------------------------------
// Shared schema description (embedded in prompts so the model knows the types)
// ---------------------------------------------------------------------------

const PART_STATE_SCHEMA_DESCRIPTION = `
## PartState JSON Schema

You MUST return valid JSON matching this exact TypeScript structure.
Use crypto-style UUIDs (e.g. "a1b2c3d4-e5f6-7890-abcd-ef1234567890") for ALL id fields.

### ShapeStyle
\`\`\`
{ fill?: string; stroke?: string; strokeWidth?: number; opacity?: number; fontSize?: number; fontFamily?: string; textAnchor?: string; }
\`\`\`

### Shape (discriminated union on "type")
All shapes share: id (string UUID), x (number), y (number), width (number), height (number), rotation (number, usually 0), style? (ShapeStyle), layer? (string).

- **RectShape**: { type: "rect", rx?: number, ...base }
- **CircleShape**: { type: "circle", cx: number, cy: number, ...base }  — cx/cy are center coordinates
- **PathShape**: { type: "path", d: string, ...base }  — d is an SVG path string
- **TextShape**: { type: "text", text: string, ...base }
- **GroupShape**: { type: "group", children: Shape[], ...base }

### PadSpec
\`\`\`
{ type: "tht" | "smd"; shape: "circle" | "rect" | "oblong" | "square"; diameter?: number; drill?: number; width?: number; height?: number; }
\`\`\`

### TerminalPosition
\`\`\`
{ x: number; y: number; }
\`\`\`

### Connector
\`\`\`
{
  id: string;          // UUID
  name: string;        // Pin name, e.g. "GPIO0", "VCC", "GND"
  description?: string;
  connectorType: "male" | "female" | "pad";
  shapeIds: Record<string, string[]>;  // Map of view name ("breadboard"|"schematic"|"pcb") to array of shape IDs in that view
  terminalPositions: Record<string, TerminalPosition>;  // Map of view name to terminal position {x, y}
  padSpec?: PadSpec;
}
\`\`\`

### Bus
\`\`\`
{ id: string; name: string; connectorIds: string[]; }
\`\`\`

### PartProperty
\`\`\`
{ key: string; value: string; showInLabel?: boolean; }
\`\`\`

### PartMeta
\`\`\`
{
  title: string;
  family?: string;          // e.g. "ESP32", "ATmega", "STM32"
  manufacturer?: string;
  mpn?: string;             // Manufacturer Part Number
  description?: string;
  tags: string[];           // e.g. ["mcu", "wifi", "bluetooth"]
  mountingType: "tht" | "smd" | "other" | "";
  packageType?: string;     // e.g. "QFN-48", "DIP-28", "SOIC-8"
  properties: PartProperty[];
  datasheetUrl?: string;
  version?: string;
}
\`\`\`

### ViewData
\`\`\`
{ shapes: Shape[]; layerConfig?: Record<string, { visible: boolean; locked: boolean; color?: string }>; }
\`\`\`

### PartViews
\`\`\`
{ breadboard: ViewData; schematic: ViewData; pcb: ViewData; }
\`\`\`

### Constraint
\`\`\`
{ id: string; type: "distance" | "alignment" | "pitch" | "symmetric" | "equal" | "fixed"; shapeIds: string[]; params: Record<string, number | string>; enabled: boolean; }
\`\`\`

### PartState (top-level)
\`\`\`
{
  meta: PartMeta;
  connectors: Connector[];
  buses: Bus[];
  views: PartViews;         // Must have all 3 views: breadboard, schematic, pcb
  constraints?: Constraint[];
}
\`\`\`
`;

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

class ComponentAIError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ComponentAIError";
  }
}

/**
 * Extract and parse JSON from a model response string.
 *
 * The model may wrap the JSON in a markdown code fence or return it bare.
 * This function handles both cases, as well as responses where the model
 * prepends/appends conversational text around the JSON payload.
 */
function extractJSON<T>(responseText: string): T {
  // Try direct parse first (ideal case — responseMimeType: "application/json")
  try {
    return JSON.parse(responseText) as T;
  } catch {
    // Not raw JSON — try extracting from code fences
  }

  // Try ```json ... ``` fences
  const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/g;
  let lastFence: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(responseText)) !== null) {
    lastFence = match[1];
  }
  if (lastFence) {
    try {
      return JSON.parse(lastFence) as T;
    } catch (e) {
      throw new ComponentAIError(
        `Failed to parse JSON from code fence in AI response: ${e instanceof Error ? e.message : String(e)}`,
        e,
      );
    }
  }

  // Try finding a bare JSON object/array at any position
  const braceStart = responseText.indexOf("{");
  const bracketStart = responseText.indexOf("[");
  const start =
    braceStart === -1
      ? bracketStart
      : bracketStart === -1
        ? braceStart
        : Math.min(braceStart, bracketStart);

  if (start !== -1) {
    const isArray = responseText[start] === "[";
    const closeChar = isArray ? "]" : "}";
    // Walk backwards from end to find matching close
    const lastClose = responseText.lastIndexOf(closeChar);
    if (lastClose > start) {
      const candidate = responseText.slice(start, lastClose + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Fall through to error
      }
    }
  }

  throw new ComponentAIError(
    "AI response did not contain valid JSON. Raw response (first 500 chars): " +
      redactSecrets(responseText.slice(0, 500)),
  );
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Basic structural validation for a PartState object returned by the model.
 * This does not validate every field exhaustively — it ensures the required
 * top-level structure and types are present so downstream code won't crash.
 */
function validatePartState(data: unknown): PartState {
  if (data === null || typeof data !== "object") {
    throw new ComponentAIError("AI returned a non-object value instead of PartState");
  }

  const obj = data as Record<string, unknown>;

  // meta
  if (!obj.meta || typeof obj.meta !== "object") {
    throw new ComponentAIError("AI response missing required 'meta' object");
  }
  const meta = obj.meta as Record<string, unknown>;
  if (typeof meta.title !== "string") {
    throw new ComponentAIError("AI response meta.title must be a string");
  }
  if (!Array.isArray(meta.tags)) {
    meta.tags = [];
  }
  if (!Array.isArray(meta.properties)) {
    meta.properties = [];
  }
  if (
    typeof meta.mountingType !== "string" ||
    !["tht", "smd", "other", ""].includes(meta.mountingType as string)
  ) {
    meta.mountingType = "";
  }

  // connectors
  if (!Array.isArray(obj.connectors)) {
    obj.connectors = [];
  }

  // buses
  if (!Array.isArray(obj.buses)) {
    obj.buses = [];
  }

  // views
  if (!obj.views || typeof obj.views !== "object") {
    obj.views = { breadboard: { shapes: [] }, schematic: { shapes: [] }, pcb: { shapes: [] } };
  }
  const views = obj.views as Record<string, unknown>;
  for (const viewName of ["breadboard", "schematic", "pcb"] as const) {
    if (!views[viewName] || typeof views[viewName] !== "object") {
      views[viewName] = { shapes: [] };
    }
    const view = views[viewName] as Record<string, unknown>;
    if (!Array.isArray(view.shapes)) {
      view.shapes = [];
    }
  }

  // constraints (optional)
  if (obj.constraints !== undefined && !Array.isArray(obj.constraints)) {
    obj.constraints = undefined;
  }

  return obj as unknown as PartState;
}

/**
 * Validate an array of Connector objects from the model response.
 */
function validateConnectors(data: unknown): Connector[] {
  if (!Array.isArray(data)) {
    throw new ComponentAIError("AI response is not an array of connectors");
  }

  return data.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new ComponentAIError(`Connector at index ${index} is not an object`);
    }
    const c = item as Record<string, unknown>;
    if (typeof c.id !== "string" || typeof c.name !== "string") {
      throw new ComponentAIError(
        `Connector at index ${index} missing required 'id' or 'name' string fields`,
      );
    }
    if (
      typeof c.connectorType !== "string" ||
      !["male", "female", "pad"].includes(c.connectorType)
    ) {
      c.connectorType = "pad";
    }
    if (!c.shapeIds || typeof c.shapeIds !== "object") {
      c.shapeIds = {};
    }
    if (!c.terminalPositions || typeof c.terminalPositions !== "object") {
      c.terminalPositions = {};
    }
    return c as unknown as Connector;
  });
}

/**
 * Validate a partial PartMeta from metadata extraction.
 */
function validatePartialMeta(data: unknown): Partial<PartMeta> {
  if (data === null || typeof data !== "object") {
    throw new ComponentAIError("AI returned a non-object value instead of PartMeta");
  }

  const obj = data as Record<string, unknown>;
  const result: Partial<PartMeta> = {};

  if (typeof obj.title === "string" && obj.title.length > 0) result.title = obj.title;
  if (typeof obj.family === "string" && obj.family.length > 0) result.family = obj.family;
  if (typeof obj.manufacturer === "string" && obj.manufacturer.length > 0)
    result.manufacturer = obj.manufacturer;
  if (typeof obj.mpn === "string" && obj.mpn.length > 0) result.mpn = obj.mpn;
  if (typeof obj.description === "string" && obj.description.length > 0)
    result.description = obj.description;
  if (typeof obj.packageType === "string" && obj.packageType.length > 0)
    result.packageType = obj.packageType;
  if (typeof obj.datasheetUrl === "string" && obj.datasheetUrl.length > 0)
    result.datasheetUrl = obj.datasheetUrl;
  if (typeof obj.version === "string" && obj.version.length > 0) result.version = obj.version;

  if (Array.isArray(obj.tags)) {
    result.tags = obj.tags.filter((t): t is string => typeof t === "string");
  }

  if (
    typeof obj.mountingType === "string" &&
    ["tht", "smd", "other", ""].includes(obj.mountingType)
  ) {
    result.mountingType = obj.mountingType as PartMeta["mountingType"];
  }

  if (Array.isArray(obj.properties)) {
    result.properties = obj.properties.filter(
      (p): p is PartProperty =>
        p !== null &&
        typeof p === "object" &&
        typeof (p as Record<string, unknown>).key === "string" &&
        typeof (p as Record<string, unknown>).value === "string",
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// 1. generatePartFromDescription
// ---------------------------------------------------------------------------

/**
 * Generate a complete PartState from a text description and optional image.
 *
 * @param apiKey   - Google Gemini API key
 * @param description - Natural language description, e.g. "ESP32-S3 Module in QFN-48 package"
 * @param imageBase64 - Optional base64-encoded image of the component
 * @param imageMimeType - MIME type of the image (e.g. "image/png")
 * @returns A fully populated PartState
 */
export async function generatePartFromDescription(
  apiKey: string,
  description: string,
  imageBase64?: string,
  imageMimeType?: string,
): Promise<PartState> {
  const ai = getGenAIClient(apiKey);

  const systemInstruction = `You are an expert electronics component engineer specializing in EDA (Electronic Design Automation) part creation. Your task is to generate a complete component part definition as JSON.

Given a text description (and optionally an image) of an electronic component, you must produce a PartState JSON object that includes:

1. **meta** — Filled with as much detail as you can infer: title, family, manufacturer, MPN, description, tags, mountingType, packageType, and relevant properties (voltage ratings, current ratings, frequencies, etc.).

2. **connectors** — Every pin/pad of the component. Each connector must have:
   - A UUID id
   - A descriptive name (e.g. "VCC", "GND", "GPIO0", "MOSI")
   - connectorType: "pad" for SMD pads, "male" for through-hole pins pointing out, "female" for sockets
   - shapeIds mapping each view to the shape IDs that represent that pin in that view
   - terminalPositions mapping each view to the {x, y} location of the pin's connection point

3. **buses** — Group related connectors into buses where appropriate (e.g. SPI bus, I2C bus, power bus).

4. **views** — All three views must be populated:
   - **breadboard**: A realistic top-down visual representation with colored shapes
   - **schematic**: A standard schematic symbol (rectangle with pin stubs and labels)
   - **pcb**: Pad/footprint layout with accurate pad positions and sizes

5. **constraints** — Optional but add pitch constraints for pin arrays, alignment constraints for symmetric parts.

${PART_STATE_SCHEMA_DESCRIPTION}

## Important Rules
- Generate UUIDs for ALL id fields (format: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx")
- Shapes should use reasonable coordinates. The component body should be centered roughly around (0, 0) or start at small positive coordinates.
- Pin spacing should follow standard EDA conventions: 2.54mm (100mil) pitch for THT, appropriate pitch for SMD packages.
- Use meaningful colors: green for IC body, yellow/gold for pins, red for pin 1 markers.
- The schematic view should follow IEEE/IEC conventions: rectangle body, pin stubs extending outward, pin names inside, pin numbers outside.
- Return ONLY the JSON object — no markdown, no explanation, just the PartState JSON.`;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: `Generate a complete PartState for the following component:\n\n${description}` },
  ];

  if (imageBase64 && imageMimeType) {
    parts.push({
      inlineData: { mimeType: imageMimeType, data: imageBase64 },
    });
    parts[0] = {
      text: `Generate a complete PartState for the following component. Use both the text description and the provided image to inform your output.\n\nDescription: ${description}`,
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction,
        temperature: STRUCTURED_TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) {
      throw new ComponentAIError("AI returned an empty response when generating part");
    }

    const parsed = extractJSON<unknown>(text);
    return validatePartState(parsed);
  } catch (error) {
    if (error instanceof ComponentAIError) throw error;
    const msg =
      error instanceof Error ? error.message : String(error);
    throw new ComponentAIError(
      `Failed to generate part from description: ${redactSecrets(msg)}`,
      error,
    );
  }
}

// ---------------------------------------------------------------------------
// 2. modifyPartWithAI
// ---------------------------------------------------------------------------

/**
 * Modify an existing PartState according to a natural language instruction.
 *
 * @param apiKey      - Google Gemini API key
 * @param currentPart - The current PartState to be modified
 * @param instruction - Natural language modification, e.g. "add 4 more GPIO pins on the right side"
 * @returns The full modified PartState (caller computes diff)
 */
export async function modifyPartWithAI(
  apiKey: string,
  currentPart: PartState,
  instruction: string,
): Promise<PartState> {
  const ai = getGenAIClient(apiKey);

  const systemInstruction = `You are an expert electronics component engineer specializing in EDA part editing. You receive an existing component definition (PartState JSON) and a modification instruction. You must return the COMPLETE modified PartState — not a diff, not a partial update, but the full updated object.

## Rules
- Preserve all existing data that the instruction does not ask to change.
- When adding new pins/connectors, generate new UUIDs for them and add corresponding shapes in all three views.
- When removing pins, remove their connectors AND their associated shapes from all views.
- When repositioning elements, update both the shape coordinates and the connector terminalPositions.
- Maintain consistent pin spacing and alignment.
- Keep the schematic symbol clean and readable after modifications.
- Update the meta description/tags/properties if the modification changes the component's characteristics.

${PART_STATE_SCHEMA_DESCRIPTION}

Return ONLY the complete modified PartState JSON — no markdown, no explanation.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Here is the current component definition:\n\n\`\`\`json\n${JSON.stringify(currentPart, null, 2)}\n\`\`\`\n\nModification instruction: ${instruction}\n\nReturn the complete modified PartState JSON.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: STRUCTURED_TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) {
      throw new ComponentAIError("AI returned an empty response when modifying part");
    }

    const parsed = extractJSON<unknown>(text);
    return validatePartState(parsed);
  } catch (error) {
    if (error instanceof ComponentAIError) throw error;
    const msg =
      error instanceof Error ? error.message : String(error);
    throw new ComponentAIError(
      `Failed to modify part with AI: ${redactSecrets(msg)}`,
      error,
    );
  }
}

// ---------------------------------------------------------------------------
// 3. extractMetadataFromDatasheet
// ---------------------------------------------------------------------------

/**
 * Extract component metadata from a datasheet image (or PDF page rendered as image).
 *
 * @param apiKey     - Google Gemini API key
 * @param imageBase64 - Base64-encoded image of the datasheet page
 * @param mimeType   - MIME type of the image (e.g. "image/png", "image/jpeg")
 * @returns Partial PartMeta with whatever fields could be extracted
 */
export async function extractMetadataFromDatasheet(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
): Promise<Partial<PartMeta>> {
  const ai = getGenAIClient(apiKey);

  const systemInstruction = `You are an expert at reading electronic component datasheets. Given an image of a datasheet page, extract as much metadata as possible about the component.

Return a JSON object with these fields (omit any fields you cannot determine):

\`\`\`
{
  "title": string,           // Component name/title, e.g. "ESP32-S3-WROOM-1"
  "family": string,          // Product family, e.g. "ESP32-S3"
  "manufacturer": string,    // e.g. "Espressif Systems"
  "mpn": string,             // Manufacturer Part Number
  "description": string,     // Brief functional description
  "tags": string[],          // Categorization tags
  "mountingType": "tht" | "smd" | "other" | "",
  "packageType": string,     // e.g. "QFN-48", "SOIC-8"
  "properties": [            // Key electrical/mechanical specs
    { "key": string, "value": string, "showInLabel": boolean }
  ],
  "datasheetUrl": string,    // If a URL is visible on the page
  "version": string          // Datasheet revision/version
}
\`\`\`

Extract real data from the image — do not guess or fabricate values. If a field is not visible or determinable from the image, omit it entirely.

Return ONLY the JSON object — no markdown, no explanation.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: "Extract all component metadata from this datasheet page." },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: STRUCTURED_TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) {
      throw new ComponentAIError("AI returned an empty response when extracting metadata");
    }

    const parsed = extractJSON<unknown>(text);
    return validatePartialMeta(parsed);
  } catch (error) {
    if (error instanceof ComponentAIError) throw error;
    const msg =
      error instanceof Error ? error.message : String(error);
    throw new ComponentAIError(
      `Failed to extract metadata from datasheet: ${redactSecrets(msg)}`,
      error,
    );
  }
}

// ---------------------------------------------------------------------------
// 4. suggestDescription
// ---------------------------------------------------------------------------

/**
 * Generate a professional component description from existing metadata.
 *
 * @param apiKey - Google Gemini API key
 * @param meta   - Existing PartMeta (may be partially filled)
 * @returns A professional description string
 */
export async function suggestDescription(
  apiKey: string,
  meta: PartMeta,
): Promise<string> {
  const ai = getGenAIClient(apiKey);

  const systemInstruction = `You are a technical writer specializing in electronic component descriptions for EDA tools and component databases.

Given a component's metadata, write a clear, professional, and concise description suitable for a component library entry. The description should:

1. Start with what the component IS (e.g. "Low-power 32-bit microcontroller...")
2. Highlight key features and specifications
3. Mention the package type and mounting style if known
4. Be 1-3 sentences long
5. Use industry-standard terminology
6. Avoid marketing fluff — be factual and precise

Return ONLY the description text — no JSON wrapping, no quotes, no markdown.`;

  try {
    const metaSummary = [
      meta.title ? `Title: ${meta.title}` : null,
      meta.family ? `Family: ${meta.family}` : null,
      meta.manufacturer ? `Manufacturer: ${meta.manufacturer}` : null,
      meta.mpn ? `MPN: ${meta.mpn}` : null,
      meta.packageType ? `Package: ${meta.packageType}` : null,
      meta.mountingType ? `Mounting: ${meta.mountingType}` : null,
      meta.tags.length > 0 ? `Tags: ${meta.tags.join(", ")}` : null,
      meta.properties.length > 0
        ? `Properties:\n${meta.properties.map((p) => `  ${p.key}: ${p.value}`).join("\n")}`
        : null,
      meta.description ? `Existing description: ${meta.description}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Write a professional component description based on this metadata:\n\n${metaSummary}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: CREATIVE_TEMPERATURE,
        maxOutputTokens: 512,
      },
    });

    const text = response.text;
    if (!text) {
      throw new ComponentAIError("AI returned an empty response when suggesting description");
    }

    // Clean up: remove surrounding quotes if the model wrapped them
    return text.replace(/^["']|["']$/g, "").trim();
  } catch (error) {
    if (error instanceof ComponentAIError) throw error;
    const msg =
      error instanceof Error ? error.message : String(error);
    throw new ComponentAIError(
      `Failed to suggest description: ${redactSecrets(msg)}`,
      error,
    );
  }
}

// ---------------------------------------------------------------------------
// 5. extractPinsFromPhoto
// ---------------------------------------------------------------------------

/**
 * Extract pin/connector information from a photo of a physical chip.
 *
 * @param apiKey       - Google Gemini API key
 * @param imageBase64  - Base64-encoded photo of the chip
 * @param mimeType     - MIME type of the image
 * @param existingMeta - Optional partial metadata to help identify the component
 * @returns Array of Connector objects with names and approximate positions
 */
export async function extractPinsFromPhoto(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  existingMeta?: Partial<PartMeta>,
): Promise<Connector[]> {
  const ai = getGenAIClient(apiKey);

  const metaContext = existingMeta
    ? `\nKnown information about this component:\n${[
        existingMeta.title ? `- Title: ${existingMeta.title}` : null,
        existingMeta.family ? `- Family: ${existingMeta.family}` : null,
        existingMeta.manufacturer ? `- Manufacturer: ${existingMeta.manufacturer}` : null,
        existingMeta.mpn ? `- MPN: ${existingMeta.mpn}` : null,
        existingMeta.packageType ? `- Package: ${existingMeta.packageType}` : null,
        existingMeta.mountingType ? `- Mounting: ${existingMeta.mountingType}` : null,
      ]
        .filter(Boolean)
        .join("\n")}\n`
    : "";

  const systemInstruction = `You are an expert at identifying electronic component pins from physical photographs. Given a photo of a chip or component, identify all visible pins and their likely functions.

${metaContext}

For each pin you can identify, create a Connector object:

\`\`\`
{
  "id": string,          // Generate a UUID
  "name": string,        // Pin name (e.g. "VCC", "GND", "GPIO0", "pin 1")
  "description": string, // Brief description of pin function
  "connectorType": "pad" | "male" | "female",  // "pad" for SMD, "male" for THT pins
  "shapeIds": {},        // Leave empty — shapes will be created later
  "terminalPositions": {
    "pcb": { "x": <number>, "y": <number> }  // Approximate position relative to component center
  }
}
\`\`\`

## Guidelines
- Identify pin 1 first (look for dot, notch, bevel, or marking)
- Number pins counter-clockwise from pin 1 (DIP/SOIC convention) or use standard IC pin numbering
- If you can read pin names/numbers from the silkscreen or markings, use those
- If you cannot read specific pin names, use positional names (e.g. "pin 1", "pin 2")
- For common IC packages, infer pin names from the component family if known
- Use reasonable spacing between pins (2.54mm for THT, 0.5-1.27mm for SMD)
- Position coordinates should be in millimeters relative to the component center at (0, 0)

Return ONLY a JSON array of Connector objects — no markdown, no explanation.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Identify all pins visible in this chip photo and return them as Connector objects.",
            },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: STRUCTURED_TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) {
      throw new ComponentAIError("AI returned an empty response when extracting pins");
    }

    const parsed = extractJSON<unknown>(text);
    return validateConnectors(parsed);
  } catch (error) {
    if (error instanceof ComponentAIError) throw error;
    const msg =
      error instanceof Error ? error.message : String(error);
    throw new ComponentAIError(
      `Failed to extract pins from photo: ${redactSecrets(msg)}`,
      error,
    );
  }
}
