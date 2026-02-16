export default function SchematicView() {
  return (
    <div className="w-full h-full bg-[#1e1e1e] relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{
             backgroundImage: 'radial-gradient(#4a4a4a 1px, transparent 1px)',
             backgroundSize: '20px 20px'
           }}>
      </div>
      
      {/* Mock Schematic SVG */}
      <svg width="800" height="600" viewBox="0 0 800 600" className="w-full h-full max-w-4xl max-h-3xl stroke-foreground/80">
        <defs>
          <marker id="dot" markerWidth="4" markerHeight="4" refX="2" refY="2">
            <circle cx="2" cy="2" r="2" fill="currentColor" />
          </marker>
        </defs>
        
        {/* MCU Box */}
        <g transform="translate(300, 200)">
          <rect x="0" y="0" width="200" height="150" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
          <text x="100" y="75" textAnchor="middle" fill="currentColor" className="font-mono text-sm">ESP32-S3</text>
          
          {/* Pins Left */}
          <line x1="-20" y1="30" x2="0" y2="30" stroke="currentColor" />
          <text x="-25" y="34" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">3V3</text>
          <line x1="-20" y1="60" x2="0" y2="60" stroke="currentColor" />
          <text x="-25" y="64" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">GND</text>
          
          {/* Pins Right */}
          <line x1="200" y1="30" x2="220" y2="30" stroke="currentColor" />
          <text x="225" y="34" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">MOSI</text>
          <line x1="200" y1="50" x2="220" y2="50" stroke="currentColor" />
          <text x="225" y="54" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">MISO</text>
          <line x1="200" y1="70" x2="220" y2="70" stroke="currentColor" />
          <text x="225" y="74" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">SCK</text>
          <line x1="200" y1="90" x2="220" y2="90" stroke="currentColor" />
          <text x="225" y="94" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">CS</text>
        </g>

        {/* PMU Box */}
        <g transform="translate(50, 200)">
          <rect x="0" y="0" width="100" height="80" fill="none" stroke="currentColor" strokeWidth="2" className="text-secondary" />
          <text x="50" y="40" textAnchor="middle" fill="currentColor" className="font-mono text-xs">TP4056</text>
          <line x1="100" y1="30" x2="120" y2="30" stroke="currentColor" />
        </g>

        {/* LoRa Box */}
        <g transform="translate(600, 200)">
          <rect x="0" y="0" width="120" height="100" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" />
          <text x="60" y="50" textAnchor="middle" fill="currentColor" className="font-mono text-xs">SX1262</text>
          <line x1="-20" y1="30" x2="0" y2="30" stroke="currentColor" />
          <line x1="-20" y1="50" x2="0" y2="50" stroke="currentColor" />
          <line x1="-20" y1="70" x2="0" y2="70" stroke="currentColor" />
          <line x1="-20" y1="90" x2="0" y2="90" stroke="currentColor" />
        </g>

        {/* Wires */}
        <path d="M 170 230 L 280 230" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M 520 230 L 580 230" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M 520 250 L 580 250" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M 520 270 L 580 270" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M 520 290 L 580 290" stroke="currentColor" strokeWidth="1" fill="none" />

      </svg>

      <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-card/80 backdrop-blur border border-border text-xs text-muted-foreground font-mono">
        MODE: SCHEMATIC // READ-ONLY
      </div>
    </div>
  );
}
