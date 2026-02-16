import { useProject } from '@/lib/project-context';

function TopSchematic() {
  return (
    <svg width="800" height="600" viewBox="0 0 800 600" className="w-full h-full max-w-4xl max-h-3xl stroke-foreground/80">
      <defs>
        <marker id="dot" markerWidth="4" markerHeight="4" refX="2" refY="2">
          <circle cx="2" cy="2" r="2" fill="currentColor" />
        </marker>
      </defs>
      
      <g transform="translate(300, 200)">
        <rect x="0" y="0" width="200" height="150" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
        <text x="100" y="75" textAnchor="middle" fill="currentColor" className="font-mono text-sm">ESP32-S3</text>
        
        <line x1="-20" y1="30" x2="0" y2="30" stroke="currentColor" />
        <text x="-25" y="34" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">3V3</text>
        <line x1="-20" y1="60" x2="0" y2="60" stroke="currentColor" />
        <text x="-25" y="64" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">GND</text>
        
        <line x1="200" y1="30" x2="220" y2="30" stroke="currentColor" />
        <text x="225" y="34" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">MOSI</text>
        <line x1="200" y1="50" x2="220" y2="50" stroke="currentColor" />
        <text x="225" y="54" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">MISO</text>
        <line x1="200" y1="70" x2="220" y2="70" stroke="currentColor" />
        <text x="225" y="74" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">SCK</text>
        <line x1="200" y1="90" x2="220" y2="90" stroke="currentColor" />
        <text x="225" y="94" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">CS</text>
      </g>

      <g transform="translate(50, 200)">
        <rect x="0" y="0" width="100" height="80" fill="none" stroke="currentColor" strokeWidth="2" className="text-secondary" />
        <text x="50" y="40" textAnchor="middle" fill="currentColor" className="font-mono text-xs">TP4056</text>
        <line x1="100" y1="30" x2="120" y2="30" stroke="currentColor" />
      </g>

      <g transform="translate(600, 200)">
        <rect x="0" y="0" width="120" height="100" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" />
        <text x="60" y="50" textAnchor="middle" fill="currentColor" className="font-mono text-xs">SX1262</text>
        <line x1="-20" y1="30" x2="0" y2="30" stroke="currentColor" />
        <line x1="-20" y1="50" x2="0" y2="50" stroke="currentColor" />
        <line x1="-20" y1="70" x2="0" y2="70" stroke="currentColor" />
        <line x1="-20" y1="90" x2="0" y2="90" stroke="currentColor" />
      </g>

      <path d="M 170 230 L 280 230" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M 520 230 L 580 230" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M 520 250 L 580 250" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M 520 270 L 580 270" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M 520 290 L 580 290" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

function PowerSchematic() {
  return (
    <svg width="800" height="600" viewBox="0 0 800 600" className="w-full h-full max-w-4xl max-h-3xl stroke-foreground/80">
      <g transform="translate(100, 250)">
        <rect x="0" y="0" width="100" height="60" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" />
        <text x="50" y="35" textAnchor="middle" fill="currentColor" className="font-mono text-xs">USB-C</text>
        <line x1="100" y1="20" x2="140" y2="20" stroke="currentColor" />
        <text x="120" y="15" textAnchor="middle" fill="currentColor" className="font-mono text-[10px]">VBUS</text>
        <line x1="100" y1="40" x2="140" y2="40" stroke="currentColor" />
        <text x="120" y="55" textAnchor="middle" fill="currentColor" className="font-mono text-[10px]">GND</text>
      </g>

      <g transform="translate(300, 230)">
        <rect x="0" y="0" width="140" height="100" fill="none" stroke="currentColor" strokeWidth="2" className="text-secondary" />
        <text x="70" y="45" textAnchor="middle" fill="currentColor" className="font-mono text-sm">TP4056</text>
        <text x="70" y="65" textAnchor="middle" fill="currentColor" className="font-mono text-[10px]">Li-Ion Charger</text>
        <line x1="-20" y1="20" x2="0" y2="20" stroke="currentColor" />
        <text x="-25" y="24" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">IN</text>
        <line x1="-20" y1="40" x2="0" y2="40" stroke="currentColor" />
        <text x="-25" y="44" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">GND</text>
        <line x1="140" y1="20" x2="160" y2="20" stroke="currentColor" />
        <text x="165" y="24" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">BAT+</text>
        <line x1="140" y1="50" x2="160" y2="50" stroke="currentColor" />
        <text x="165" y="54" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">OUT</text>
      </g>

      <g transform="translate(560, 240)">
        <rect x="0" y="0" width="120" height="80" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
        <text x="60" y="35" textAnchor="middle" fill="currentColor" className="font-mono text-xs">Li-Po</text>
        <text x="60" y="55" textAnchor="middle" fill="currentColor" className="font-mono text-[10px]">3.7V 2000mAh</text>
        <line x1="-20" y1="20" x2="0" y2="20" stroke="currentColor" />
      </g>

      <path d="M 240 270 L 280 250" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M 240 290 L 280 270" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M 460 250 L 540 260" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

function McuSchematic() {
  return (
    <svg width="800" height="600" viewBox="0 0 800 600" className="w-full h-full max-w-4xl max-h-3xl stroke-foreground/80">
      <g transform="translate(250, 150)">
        <rect x="0" y="0" width="300" height="300" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
        <text x="150" y="140" textAnchor="middle" fill="currentColor" className="font-mono text-lg">ESP32-S3</text>
        <text x="150" y="170" textAnchor="middle" fill="currentColor" className="font-mono text-[10px]">WROOM-1 Module</text>

        <line x1="-30" y1="40" x2="0" y2="40" stroke="currentColor" />
        <text x="-35" y="44" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">3V3</text>
        <line x1="-30" y1="70" x2="0" y2="70" stroke="currentColor" />
        <text x="-35" y="74" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">GND</text>
        <line x1="-30" y1="100" x2="0" y2="100" stroke="currentColor" />
        <text x="-35" y="104" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">EN</text>
        <line x1="-30" y1="130" x2="0" y2="130" stroke="currentColor" />
        <text x="-35" y="134" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">IO0</text>
        <line x1="-30" y1="160" x2="0" y2="160" stroke="currentColor" />
        <text x="-35" y="164" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">SDA</text>
        <line x1="-30" y1="190" x2="0" y2="190" stroke="currentColor" />
        <text x="-35" y="194" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">SCL</text>
        <line x1="-30" y1="220" x2="0" y2="220" stroke="currentColor" />
        <text x="-35" y="224" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">TX</text>
        <line x1="-30" y1="250" x2="0" y2="250" stroke="currentColor" />
        <text x="-35" y="254" textAnchor="end" fill="currentColor" className="font-mono text-[10px]">RX</text>

        <line x1="300" y1="40" x2="330" y2="40" stroke="currentColor" />
        <text x="335" y="44" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">MOSI</text>
        <line x1="300" y1="70" x2="330" y2="70" stroke="currentColor" />
        <text x="335" y="74" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">MISO</text>
        <line x1="300" y1="100" x2="330" y2="100" stroke="currentColor" />
        <text x="335" y="104" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">SCK</text>
        <line x1="300" y1="130" x2="330" y2="130" stroke="currentColor" />
        <text x="335" y="134" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">CS</text>
        <line x1="300" y1="160" x2="330" y2="160" stroke="currentColor" />
        <text x="335" y="164" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">ADC1</text>
        <line x1="300" y1="190" x2="330" y2="190" stroke="currentColor" />
        <text x="335" y="194" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">ADC2</text>
        <line x1="300" y1="220" x2="330" y2="220" stroke="currentColor" />
        <text x="335" y="224" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">GPIO18</text>
        <line x1="300" y1="250" x2="330" y2="250" stroke="currentColor" />
        <text x="335" y="254" textAnchor="start" fill="currentColor" className="font-mono text-[10px]">GPIO19</text>
      </g>
    </svg>
  );
}

export default function SchematicView() {
  const { activeSheetId, schematicSheets } = useProject();

  const activeSheet = schematicSheets.find(s => s.id === activeSheetId);

  return (
    <div className="w-full h-full bg-[#1e1e1e] relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{
             backgroundImage: 'radial-gradient(#4a4a4a 1px, transparent 1px)',
             backgroundSize: '20px 20px'
           }}>
      </div>
      
      {activeSheetId === 'power' ? <PowerSchematic /> : activeSheetId === 'mcu' ? <McuSchematic /> : <TopSchematic />}

      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="px-3 py-1 bg-card/80 backdrop-blur border border-border text-xs text-muted-foreground font-mono">
          MODE: SCHEMATIC // READ-ONLY
        </div>
        <div className="px-3 py-1 bg-card/80 backdrop-blur border border-border text-xs font-mono text-primary">
          SHEET: {activeSheet?.name || 'Unknown'}
        </div>
      </div>
    </div>
  );
}
