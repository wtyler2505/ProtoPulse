import type { ActionHandler } from './types';

// ---------------------------------------------------------------------------
// generate_arduino_sketch
// ---------------------------------------------------------------------------

const generateArduinoSketch: ActionHandler = (action, ctx) => {
  const intent = typeof action.intent === 'string' ? action.intent : String(action.intent ?? '');
  ctx.output.addOutputLog(`[Arduino] Generating sketch: "${intent}"`);
  ctx.history.addToHistory(`Generated Arduino sketch: ${intent}`, 'AI');
  ctx.setActiveView('arduino');

  if (ctx.arduino) {
    ctx.arduino.generateSketch(intent).then((code) => {
      ctx.output.addOutputLog(`[Arduino] Sketch generated (${code.length} chars) — open Arduino Workbench to edit.`);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.output.addOutputLog(`[Arduino] Sketch generation failed: ${msg}`);
    });
  }
};

// ---------------------------------------------------------------------------
// compile_sketch
// ---------------------------------------------------------------------------

const compileSketch: ActionHandler = (action, ctx) => {
  const fqbn = typeof action.fqbn === 'string' ? action.fqbn : 'arduino:avr:uno';
  ctx.output.addOutputLog(`[Arduino] Starting compilation for board: ${fqbn}`);
  ctx.setActiveView('arduino');

  if (ctx.arduino) {
    ctx.arduino.compileJob({ fqbn, sketchPath: '.' }).then((job) => {
      ctx.output.addOutputLog(`[Arduino] Compilation job started (id: ${job.id})`);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.output.addOutputLog(`[Arduino] Compilation failed: ${msg}`);
    });
  }
};

// ---------------------------------------------------------------------------
// upload_firmware
// ---------------------------------------------------------------------------

const uploadFirmware: ActionHandler = (action, ctx) => {
  const fqbn = typeof action.fqbn === 'string' ? action.fqbn : 'arduino:avr:uno';
  const port = typeof action.port === 'string' ? action.port : '';
  ctx.output.addOutputLog(`[Arduino] Starting upload → ${port} (${fqbn})`);
  ctx.setActiveView('arduino');

  if (!port) {
    ctx.output.addOutputLog('[Arduino] Upload skipped — no port specified.');
    return;
  }

  if (ctx.arduino) {
    ctx.arduino.uploadJob({ fqbn, port, sketchPath: '.' }).then((job) => {
      ctx.output.addOutputLog(`[Arduino] Upload job started (id: ${job.id})`);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.output.addOutputLog(`[Arduino] Upload failed: ${msg}`);
    });
  }
};

// ---------------------------------------------------------------------------
// search_arduino_libraries
// ---------------------------------------------------------------------------

const searchLibraries: ActionHandler = (action, ctx) => {
  const query = typeof action.query === 'string' ? action.query : String(action.query ?? '');
  ctx.output.addOutputLog(`[Arduino] Searching libraries for: "${query}"`);
  ctx.setActiveView('arduino');

  if (ctx.arduino) {
    ctx.arduino.searchLibraries(query).then((results) => {
      const count = Array.isArray(results) ? results.length : '?';
      ctx.output.addOutputLog(`[Arduino] Library search complete — ${count} result(s) for "${query}".`);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.output.addOutputLog(`[Arduino] Library search failed: ${msg}`);
    });
  }
};

// ---------------------------------------------------------------------------
// list_arduino_boards
// ---------------------------------------------------------------------------

const listBoards: ActionHandler = (_action, ctx) => {
  ctx.output.addOutputLog('[Arduino] Discovering connected boards...');
  ctx.setActiveView('arduino');

  if (ctx.arduino) {
    ctx.arduino.listBoards().then((boards) => {
      if (!boards.length) {
        ctx.output.addOutputLog('[Arduino] No boards detected. Is a board plugged in via USB?');
        return;
      }
      boards.forEach((b) => {
        const board = b as Record<string, unknown>;
        const name = String(board.matching_boards
          ? (board.matching_boards as Array<Record<string, unknown>>)[0]?.name ?? 'Unknown'
          : board.port ?? 'Unknown');
        const port = String((board.port as Record<string, unknown>)?.address ?? board.port ?? '?');
        ctx.output.addOutputLog(`[Arduino] Found: ${name} on ${port}`);
      });
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.output.addOutputLog(`[Arduino] Board discovery failed: ${msg}`);
    });
  }
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const arduinoHandlers: Record<string, ActionHandler> = {
  generate_arduino_sketch: generateArduinoSketch,
  compile_sketch: compileSketch,
  upload_firmware: uploadFirmware,
  search_arduino_libraries: searchLibraries,
  list_arduino_boards: listBoards,
};
