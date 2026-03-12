export function generateTeardropPoints(
  traceP1: {x: number; y: number},
  traceP2: {x: number; y: number}, // P2 is the pad center
  traceWidth: number,
  padDiameter: number
): Array<{x: number; y: number}> {
  const dx = traceP2.x - traceP1.x;
  const dy = traceP2.y - traceP1.y;
  const len = Math.sqrt(dx*dx + dy*dy);
  
  if (len < traceWidth) return []; // Too short to teardrop
  
  // Normalized direction vector
  const nx = dx / len;
  const ny = dy / len;
  
  // Teardrop length: 1.5 * pad diameter or limited by trace length
  const tearLen = Math.min(len * 0.8, padDiameter * 1.5);
  
  // Point along the trace where teardrop starts
  const startX = traceP2.x - nx * tearLen;
  const startY = traceP2.y - ny * tearLen;
  
  // Pad tangents: perpendicular to incoming trace
  // We approximate teardrop by attaching to the pad at 90 deg from entry point
  const perpX = -ny;
  const perpY = nx;
  
  const r = padDiameter / 2;
  
  // Two points on the circumference of the pad
  const pLeftX = traceP2.x + perpX * r * 0.8;
  const pLeftY = traceP2.y + perpY * r * 0.8;
  
  const pRightX = traceP2.x - perpX * r * 0.8;
  const pRightY = traceP2.y - perpY * r * 0.8;
  
  return [
    { x: startX, y: startY },
    { x: pLeftX, y: pLeftY },
    { x: pRightX, y: pRightY }
  ];
}