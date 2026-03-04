import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Globals stubs
// ---------------------------------------------------------------------------

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

import {
  DesignImporter,
  useDesignImport,
} from '../design-import';
import type {
  ImportedDesign,
  ImportedComponent,
  ImportedNet,
  ImportFormat,
} from '../design-import';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshImporter(): DesignImporter {
  DesignImporter.resetForTesting();
  for (const k of Object.keys(store)) {
    delete store[k];
  }
  return DesignImporter.getInstance();
}

// ---------------------------------------------------------------------------
// Sample file content helpers
// ---------------------------------------------------------------------------

function kicadSchContent(opts?: { title?: string; date?: string; version?: string }): string {
  const version = opts?.version ?? '20211014';
  const title = opts?.title ?? 'Test Schematic';
  const date = opts?.date ?? '2024-01-01';
  return `(kicad_sch (version ${version})
  (title_block
    (title "${title}")
    (date "${date}")
  )
  (symbol "R1"
    (lib_id "Device:R")
    (at 100 50 0)
    (property "Reference" "R1")
    (property "Value" "10k")
    (property "Footprint" "Resistor_SMD:R_0402")
    (pin passive (name "1") (number "1") (at 100 40))
    (pin passive (name "2") (number "2") (at 100 60))
  )
  (symbol "C1"
    (lib_id "Device:C")
    (at 200 50)
    (property "Reference" "C1")
    (property "Value" "100nF")
    (property "Footprint" "Capacitor_SMD:C_0402")
  )
  (wire (pts (xy 100 60) (xy 200 60)))
  (wire (pts (xy 50 30) (xy 100 30)))
  (label "VCC" (at 50 30))
  (global_label "GND" (at 200 70))
)`;
}

function kicadPcbContent(): string {
  return `(kicad_pcb (version 20211014)
  (net 0 "")
  (net 1 "VCC")
  (net 2 "GND")
  (footprint "Resistor_SMD:R_0402"
    (at 100 50 90)
    (layer "F.Cu")
    (fp_text reference "R1")
    (fp_text value "10k")
    (pad "1" smd roundrect (at -0.5 0))
    (pad "2" smd roundrect (at 0.5 0))
  )
  (footprint "Capacitor_SMD:C_0402"
    (at 200 50)
    (layer "F.Cu")
    (fp_text reference "C1")
    (fp_text value "100nF")
    (pad "1" thru_hole circle (at -0.5 0))
    (pad "2" thru_hole circle (at 0.5 0))
  )
  (segment (start 100 50) (end 200 50) (width 0.25) (layer "F.Cu") (net 1))
)`;
}

function kicadSymContent(): string {
  return `(kicad_symbol_lib (version 20211014)
  (symbol "R"
    (property "Reference" "R")
    (property "Value" "R")
    (property "Footprint" "")
    (symbol "R_0_1"
      (pin passive line (name "1") (number "1") (at 0 1.27))
      (pin passive line (name "2") (number "2") (at 0 -1.27))
    )
  )
  (symbol "C"
    (property "Reference" "C")
    (property "Value" "C")
    (symbol "C_0_1"
      (pin passive line (name "1") (number "1") (at 0 1.27))
      (pin passive line (name "2") (number "2") (at 0 -1.27))
    )
  )
)`;
}

function eagleSchContent(opts?: { version?: string }): string {
  const version = opts?.version ?? '9.6.2';
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE eagle SYSTEM "eagle.dtd">
<eagle version="${version}">
  <drawing>
    <schematic>
      <parts>
        <part name="R1" library="rcl" deviceset="R-US_" device="R0402" value="10k"/>
        <part name="C1" library="rcl" deviceset="C-US" device="C0402" value="100nF"/>
      </parts>
      <sheets>
        <sheet>
          <nets>
            <net name="VCC">
              <segment>
                <pinref part="R1" pin="1"/>
                <pinref part="C1" pin="1"/>
                <wire x1="10" y1="20" x2="30" y2="40" width="0.1524" layer="91"/>
              </segment>
            </net>
            <net name="GND">
              <segment>
                <pinref part="R1" pin="2"/>
              </segment>
            </net>
          </nets>
        </sheet>
      </sheets>
    </schematic>
  </drawing>
</eagle>`;
}

function eagleBrdContent(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<eagle version="9.6.2">
  <drawing>
    <board>
      <elements>
        <element name="R1" library="rcl" package="R0402" value="10k" x="10" y="20" rot="R90"/>
        <element name="C1" library="rcl" package="C0402" value="100nF" x="30" y="40"/>
      </elements>
      <signals>
        <signal name="VCC">
          <contactref element="R1" pad="1"/>
          <contactref element="C1" pad="1"/>
          <wire x1="10" y1="20" x2="30" y2="40" width="0.25" layer="1"/>
        </signal>
        <signal name="GND">
          <contactref element="R1" pad="2"/>
        </signal>
      </signals>
    </board>
  </drawing>
</eagle>`;
}

function eagleLbrContent(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<eagle version="9.6.2">
  <drawing>
    <library name="my-lib">
      <packages>
        <package name="R0402"/>
      </packages>
      <symbols>
        <symbol name="RESISTOR">
          <pin name="1" x="0" y="2.54" direction="passive"/>
          <pin name="2" x="0" y="-2.54" direction="passive"/>
        </symbol>
      </symbols>
      <devicesets>
        <deviceset name="R-US_" prefix="R">
          <gates>
            <gate name="G$1" symbol="RESISTOR" x="0" y="0"/>
          </gates>
          <devices>
            <device name="R0402" package="R0402"/>
          </devices>
        </deviceset>
      </devicesets>
    </library>
  </drawing>
</eagle>`;
}

function altiumSchContent(): string {
  return [
    '|RECORD=31|TITLE=Test Board|DATE=2024-01-15',
    '|RECORD=1|LIBREFERENCE=RES|DESIGNATOR=R1|COMPONENTDESCRIPTION=10k Resistor|FOOTPRINT=0402|SOURCELIBRARYNAME=Misc|OWNERINDEX=1|LOCATION_X=100|LOCATION_Y=200',
    '|RECORD=2|OWNERINDEX=1|NAME=Pin1|DESIGNATOR=1|ELECTRICAL=passive|LOCATION_X=100|LOCATION_Y=210',
    '|RECORD=2|OWNERINDEX=1|NAME=Pin2|DESIGNATOR=2|ELECTRICAL=passive|LOCATION_X=100|LOCATION_Y=190',
    '|RECORD=1|LIBREFERENCE=CAP|DESIGNATOR=C1|COMPONENTDESCRIPTION=100nF|FOOTPRINT=0402|SOURCELIBRARYNAME=Misc|OWNERINDEX=2|LOCATION_X=200|LOCATION_Y=200',
    '|RECORD=27|LOCATION_X=100|LOCATION_Y=190|CORNER_X=200|CORNER_Y=190',
    '|RECORD=25|TEXT=VCC',
    '|RECORD=17|TEXT=GND',
  ].join('\n');
}

function altiumPcbContent(): string {
  return [
    '|RECORD=Board|TITLE=Test PCB',
    '|RECORD=Component|DESIGNATOR=R1|PATTERN=R0402|COMMENT=10k|X=100|Y=200|ROTATION=90|LAYER=TopLayer',
    '|RECORD=Component|DESIGNATOR=C1|PATTERN=C0402|COMMENT=100nF|X=300|Y=200|LAYER=TopLayer',
    '|RECORD=Net|NAME=VCC|NETCLASS=Signal',
    '|RECORD=Net|NAME=GND|NETCLASS=Power',
    '|RECORD=Track|X1=100|Y1=200|X2=300|Y2=200|WIDTH=0.254|LAYER=TopLayer|NET=VCC',
    '|RECORD=Pad|COMPONENT=R1|DESIGNATOR=1|NET=VCC',
    '|RECORD=Pad|COMPONENT=C1|DESIGNATOR=1|NET=VCC',
    '|RECORD=Pad|COMPONENT=R1|DESIGNATOR=2|NET=GND',
  ].join('\n');
}

// ===========================================================================
// Tests
// ===========================================================================

describe('DesignImporter', () => {
  let importer: DesignImporter;

  beforeEach(() => {
    importer = freshImporter();
  });

  // -----------------------------------------------------------------------
  // Singleton & lifecycle
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = DesignImporter.getInstance();
      const b = DesignImporter.getInstance();
      expect(a).toBe(b);
    });

    it('resetForTesting creates a new instance', () => {
      const a = DesignImporter.getInstance();
      DesignImporter.resetForTesting();
      const b = DesignImporter.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  describe('subscribe / notify', () => {
    it('notifies listeners on import', () => {
      const listener = vi.fn();
      importer.subscribe(listener);
      importer.importFile(kicadSchContent(), 'test.kicad_sch');
      expect(listener).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = importer.subscribe(listener);
      unsub();
      importer.importFile(kicadSchContent(), 'test.kicad_sch');
      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies on clearHistory', () => {
      const listener = vi.fn();
      importer.subscribe(listener);
      importer.clearHistory();
      expect(listener).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Format detection
  // -----------------------------------------------------------------------

  describe('detectFormat', () => {
    it('detects KiCad schematic by content', () => {
      const result = importer.detectFormat(kicadSchContent());
      expect(result.format).toBe('kicad-schematic');
      expect(result.confidence).toBe(1.0);
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it('detects KiCad PCB by content', () => {
      const result = importer.detectFormat(kicadPcbContent());
      expect(result.format).toBe('kicad-pcb');
      expect(result.confidence).toBe(1.0);
    });

    it('detects KiCad symbol lib by content', () => {
      const result = importer.detectFormat(kicadSymContent());
      expect(result.format).toBe('kicad-symbol');
      expect(result.confidence).toBe(1.0);
    });

    it('detects EAGLE schematic by content', () => {
      const result = importer.detectFormat(eagleSchContent());
      expect(result.format).toBe('eagle-schematic');
      expect(result.confidence).toBe(1.0);
    });

    it('detects EAGLE board by content', () => {
      const result = importer.detectFormat(eagleBrdContent());
      expect(result.format).toBe('eagle-board');
      expect(result.confidence).toBe(1.0);
    });

    it('detects EAGLE library by content', () => {
      const result = importer.detectFormat(eagleLbrContent());
      expect(result.format).toBe('eagle-library');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects Altium schematic by content', () => {
      const result = importer.detectFormat(altiumSchContent());
      expect(result.format).toBe('altium-schematic');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects Altium PCB by content', () => {
      const result = importer.detectFormat(altiumPcbContent());
      expect(result.format).toBe('altium-pcb');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('returns null for unknown content', () => {
      const result = importer.detectFormat('just some random text here');
      expect(result.format).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('returns null for empty content', () => {
      const result = importer.detectFormat('');
      expect(result.format).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('uses filename extension as fallback for KiCad schematic', () => {
      const result = importer.detectFormat('some content', 'board.kicad_sch');
      expect(result.format).toBe('kicad-schematic');
      expect(result.confidence).toBe(0.7);
    });

    it('uses filename extension for KiCad PCB', () => {
      const result = importer.detectFormat('some content', 'board.kicad_pcb');
      expect(result.format).toBe('kicad-pcb');
      expect(result.confidence).toBe(0.7);
    });

    it('uses filename extension for KiCad symbol', () => {
      const result = importer.detectFormat('some content', 'lib.kicad_sym');
      expect(result.format).toBe('kicad-symbol');
      expect(result.confidence).toBe(0.7);
    });

    it('uses filename extension for EAGLE .sch with XML', () => {
      const result = importer.detectFormat('<something>', 'circuit.sch');
      expect(result.format).toBe('eagle-schematic');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('uses filename extension for Altium SchDoc', () => {
      const result = importer.detectFormat('some content', 'circuit.SchDoc');
      expect(result.format).toBe('altium-schematic');
      expect(result.confidence).toBe(0.7);
    });

    it('uses filename extension for Altium PcbDoc', () => {
      const result = importer.detectFormat('some content', 'board.PcbDoc');
      expect(result.format).toBe('altium-pcb');
      expect(result.confidence).toBe(0.7);
    });
  });

  // -----------------------------------------------------------------------
  // KiCad schematic parsing
  // -----------------------------------------------------------------------

  describe('parseKicadSchematic', () => {
    it('parses components', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      expect(design.components.length).toBe(2);
      expect(design.components[0].refDes).toBe('R1');
      expect(design.components[0].value).toBe('10k');
      expect(design.components[0].package).toBe('Resistor_SMD:R_0402');
    });

    it('parses wires', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      expect(design.wires.length).toBe(2);
      expect(design.wires[0].start).toEqual({ x: 100, y: 60 });
      expect(design.wires[0].end).toEqual({ x: 200, y: 60 });
    });

    it('parses net labels', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      const netNames = design.nets.map((n) => n.name);
      expect(netNames).toContain('VCC');
      expect(netNames).toContain('GND');
    });

    it('parses metadata (title, date, version)', () => {
      const design = importer.parseKicadSchematic(kicadSchContent({ title: 'My Board', date: '2024-06-15', version: '20240101' }));
      expect(design.title).toBe('My Board');
      expect(design.date).toBe('2024-06-15');
      expect(design.version).toBe('20240101');
    });

    it('parses component position', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      expect(design.components[0].position).toEqual({ x: 100, y: 50 });
    });

    it('parses component pins', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      expect(design.components[0].pins.length).toBe(2);
      expect(design.components[0].pins[0].number).toBe('1');
      expect(design.components[0].pins[0].type).toBe('passive');
    });

    it('returns error for invalid content', () => {
      const design = importer.parseKicadSchematic('not a valid kicad file');
      expect(design.errors.length).toBeGreaterThan(0);
    });

    it('sets format correctly', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      expect(design.format).toBe('kicad-schematic');
    });
  });

  // -----------------------------------------------------------------------
  // KiCad PCB parsing
  // -----------------------------------------------------------------------

  describe('parseKicadPcb', () => {
    it('parses footprints as components', () => {
      const design = importer.parseKicadPcb(kicadPcbContent());
      expect(design.components.length).toBe(2);
      expect(design.components[0].refDes).toBe('R1');
      expect(design.components[0].value).toBe('10k');
    });

    it('parses nets', () => {
      const design = importer.parseKicadPcb(kicadPcbContent());
      const netNames = design.nets.map((n) => n.name);
      expect(netNames).toContain('VCC');
      expect(netNames).toContain('GND');
    });

    it('parses segments as wires', () => {
      const design = importer.parseKicadPcb(kicadPcbContent());
      expect(design.wires.length).toBe(1);
      expect(design.wires[0].start).toEqual({ x: 100, y: 50 });
      expect(design.wires[0].end).toEqual({ x: 200, y: 50 });
      expect(design.wires[0].width).toBe(0.25);
    });

    it('parses component position and rotation', () => {
      const design = importer.parseKicadPcb(kicadPcbContent());
      expect(design.components[0].position).toEqual({ x: 100, y: 50 });
      expect(design.components[0].rotation).toBe(90);
    });

    it('parses component layer', () => {
      const design = importer.parseKicadPcb(kicadPcbContent());
      expect(design.components[0].layer).toBe('F.Cu');
    });

    it('parses pads as pins', () => {
      const design = importer.parseKicadPcb(kicadPcbContent());
      expect(design.components[0].pins.length).toBe(2);
      expect(design.components[0].pins[0].number).toBe('1');
    });

    it('returns error for invalid content', () => {
      const design = importer.parseKicadPcb('invalid');
      expect(design.errors.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // KiCad symbol library parsing
  // -----------------------------------------------------------------------

  describe('parseKicadSymbol', () => {
    it('parses symbols', () => {
      const design = importer.parseKicadSymbol(kicadSymContent());
      expect(design.components.length).toBe(2);
      expect(design.components[0].name).toBe('R');
      expect(design.components[1].name).toBe('C');
    });

    it('parses pins from sub-symbols', () => {
      const design = importer.parseKicadSymbol(kicadSymContent());
      expect(design.components[0].pins.length).toBe(2);
      expect(design.components[0].pins[0].number).toBe('1');
      expect(design.components[0].pins[0].type).toBe('passive');
    });

    it('parses version', () => {
      const design = importer.parseKicadSymbol(kicadSymContent());
      expect(design.version).toBe('20211014');
    });

    it('extracts properties', () => {
      const design = importer.parseKicadSymbol(kicadSymContent());
      expect(design.components[0].refDes).toBe('R');
      expect(design.components[0].value).toBe('R');
    });

    it('returns error for invalid content', () => {
      const design = importer.parseKicadSymbol('not a sym lib');
      expect(design.errors.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // EAGLE schematic parsing
  // -----------------------------------------------------------------------

  describe('parseEagleSchematic', () => {
    it('parses parts as components', () => {
      const design = importer.parseEagleSchematic(eagleSchContent());
      expect(design.components.length).toBe(2);
      expect(design.components[0].refDes).toBe('R1');
      expect(design.components[0].value).toBe('10k');
    });

    it('parses nets with pin references', () => {
      const design = importer.parseEagleSchematic(eagleSchContent());
      expect(design.nets.length).toBe(2);
      const vcc = design.nets.find((n) => n.name === 'VCC');
      expect(vcc).toBeDefined();
      expect(vcc!.pins.length).toBe(2);
      expect(vcc!.pins[0].componentRef).toBe('R1');
    });

    it('parses wires', () => {
      const design = importer.parseEagleSchematic(eagleSchContent());
      expect(design.wires.length).toBeGreaterThan(0);
      expect(design.wires[0].start).toEqual({ x: 10, y: 20 });
      expect(design.wires[0].end).toEqual({ x: 30, y: 40 });
    });

    it('parses version', () => {
      const design = importer.parseEagleSchematic(eagleSchContent({ version: '7.5.0' }));
      expect(design.version).toBe('7.5.0');
    });

    it('parses library and device info', () => {
      const design = importer.parseEagleSchematic(eagleSchContent());
      expect(design.components[0].library).toBe('rcl');
      expect(design.components[0].package).toBe('R0402');
    });

    it('returns error for invalid content', () => {
      const design = importer.parseEagleSchematic('not xml at all');
      expect(design.errors.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // EAGLE board parsing
  // -----------------------------------------------------------------------

  describe('parseEagleBoard', () => {
    it('parses elements as components', () => {
      const design = importer.parseEagleBoard(eagleBrdContent());
      expect(design.components.length).toBe(2);
      expect(design.components[0].refDes).toBe('R1');
      expect(design.components[0].position).toEqual({ x: 10, y: 20 });
    });

    it('parses rotation', () => {
      const design = importer.parseEagleBoard(eagleBrdContent());
      expect(design.components[0].rotation).toBe(90);
    });

    it('parses signals as nets', () => {
      const design = importer.parseEagleBoard(eagleBrdContent());
      expect(design.nets.length).toBe(2);
      const vcc = design.nets.find((n) => n.name === 'VCC');
      expect(vcc).toBeDefined();
      expect(vcc!.pins.length).toBe(2);
    });

    it('parses wires', () => {
      const design = importer.parseEagleBoard(eagleBrdContent());
      expect(design.wires.length).toBeGreaterThan(0);
    });

    it('returns error for invalid content', () => {
      const design = importer.parseEagleBoard('invalid');
      expect(design.errors.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // EAGLE library parsing
  // -----------------------------------------------------------------------

  describe('parseEagleLibrary', () => {
    it('parses devicesets as components', () => {
      const design = importer.parseEagleLibrary(eagleLbrContent());
      expect(design.components.length).toBeGreaterThanOrEqual(1);
      expect(design.components[0].name).toBe('R-US_');
    });

    it('extracts library name', () => {
      const design = importer.parseEagleLibrary(eagleLbrContent());
      expect(design.metadata.libraryName).toBe('my-lib');
    });

    it('extracts package info from devices', () => {
      const design = importer.parseEagleLibrary(eagleLbrContent());
      expect(design.components[0].package).toBe('R0402');
    });

    it('extracts prefix as refDes', () => {
      const design = importer.parseEagleLibrary(eagleLbrContent());
      expect(design.components[0].refDes).toBe('R');
    });

    it('returns error for invalid content', () => {
      const design = importer.parseEagleLibrary('not eagle');
      expect(design.errors.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Altium schematic parsing
  // -----------------------------------------------------------------------

  describe('parseAltiumSchematic', () => {
    it('parses components', () => {
      const design = importer.parseAltiumSchematic(altiumSchContent());
      expect(design.components.length).toBe(2);
      expect(design.components[0].refDes).toBe('R1');
      expect(design.components[0].name).toBe('RES');
      expect(design.components[0].value).toBe('10k Resistor');
    });

    it('parses pins', () => {
      const design = importer.parseAltiumSchematic(altiumSchContent());
      expect(design.components[0].pins.length).toBe(2);
      expect(design.components[0].pins[0].name).toBe('Pin1');
      expect(design.components[0].pins[0].type).toBe('passive');
    });

    it('parses wires', () => {
      const design = importer.parseAltiumSchematic(altiumSchContent());
      expect(design.wires.length).toBe(1);
      expect(design.wires[0].start).toEqual({ x: 100, y: 190 });
      expect(design.wires[0].end).toEqual({ x: 200, y: 190 });
    });

    it('parses net labels', () => {
      const design = importer.parseAltiumSchematic(altiumSchContent());
      const names = design.nets.map((n) => n.name);
      expect(names).toContain('VCC');
      expect(names).toContain('GND');
    });

    it('parses sheet info (title, date)', () => {
      const design = importer.parseAltiumSchematic(altiumSchContent());
      expect(design.title).toBe('Test Board');
      expect(design.date).toBe('2024-01-15');
    });

    it('parses component position', () => {
      const design = importer.parseAltiumSchematic(altiumSchContent());
      expect(design.components[0].position).toEqual({ x: 100, y: 200 });
    });

    it('parses footprint', () => {
      const design = importer.parseAltiumSchematic(altiumSchContent());
      expect(design.components[0].package).toBe('0402');
    });

    it('returns error for invalid content', () => {
      const design = importer.parseAltiumSchematic('no records here');
      expect(design.errors.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Altium PCB parsing
  // -----------------------------------------------------------------------

  describe('parseAltiumPcb', () => {
    it('parses components', () => {
      const design = importer.parseAltiumPcb(altiumPcbContent());
      expect(design.components.length).toBe(2);
      expect(design.components[0].refDes).toBe('R1');
      expect(design.components[0].package).toBe('R0402');
    });

    it('parses component position and rotation', () => {
      const design = importer.parseAltiumPcb(altiumPcbContent());
      expect(design.components[0].position).toEqual({ x: 100, y: 200 });
      expect(design.components[0].rotation).toBe(90);
    });

    it('parses nets with net class', () => {
      const design = importer.parseAltiumPcb(altiumPcbContent());
      const vcc = design.nets.find((n) => n.name === 'VCC');
      expect(vcc).toBeDefined();
      expect(vcc!.netClass).toBe('Signal');
    });

    it('parses tracks as wires', () => {
      const design = importer.parseAltiumPcb(altiumPcbContent());
      expect(design.wires.length).toBe(1);
      expect(design.wires[0].start).toEqual({ x: 100, y: 200 });
      expect(design.wires[0].width).toBe(0.254);
      expect(design.wires[0].net).toBe('VCC');
    });

    it('associates pads with nets', () => {
      const design = importer.parseAltiumPcb(altiumPcbContent());
      const vcc = design.nets.find((n) => n.name === 'VCC');
      expect(vcc!.pins.length).toBe(2);
    });

    it('parses title from Board record', () => {
      const design = importer.parseAltiumPcb(altiumPcbContent());
      expect(design.title).toBe('Test PCB');
    });

    it('returns error for invalid content', () => {
      const design = importer.parseAltiumPcb('no records');
      expect(design.errors.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // importFile (auto-detect + parse)
  // -----------------------------------------------------------------------

  describe('importFile', () => {
    it('auto-detects and parses KiCad schematic', () => {
      const result = importer.importFile(kicadSchContent(), 'test.kicad_sch');
      expect(result.status).toBe('complete');
      expect(result.design).not.toBeNull();
      expect(result.design!.format).toBe('kicad-schematic');
      expect(result.componentCount).toBe(2);
      expect(result.netCount).toBeGreaterThan(0);
      expect(result.wireCount).toBe(2);
    });

    it('auto-detects and parses EAGLE schematic', () => {
      const result = importer.importFile(eagleSchContent(), 'test.sch');
      expect(result.status).toBe('complete');
      expect(result.design!.format).toBe('eagle-schematic');
      expect(result.componentCount).toBe(2);
    });

    it('auto-detects and parses Altium schematic', () => {
      const result = importer.importFile(altiumSchContent(), 'test.SchDoc');
      expect(result.status).toBe('complete');
      expect(result.design!.format).toBe('altium-schematic');
    });

    it('returns error for unknown format', () => {
      const result = importer.importFile('random text', 'unknown.xyz');
      expect(result.status).toBe('error');
      expect(result.design).toBeNull();
      expect(result.errorCount).toBe(1);
    });

    it('returns error for empty content', () => {
      const result = importer.importFile('', 'empty.kicad_sch');
      expect(result.status).toBe('error');
      expect(result.design).toBeNull();
    });

    it('records parseTime', () => {
      const result = importer.importFile(kicadSchContent(), 'test.kicad_sch');
      expect(result.parseTime).toBeGreaterThanOrEqual(0);
    });

    it('reports warning and error counts', () => {
      const result = importer.importFile(kicadSchContent(), 'test.kicad_sch');
      expect(typeof result.warningCount).toBe('number');
      expect(typeof result.errorCount).toBe('number');
    });
  });

  // -----------------------------------------------------------------------
  // convertToProtoPulse
  // -----------------------------------------------------------------------

  describe('convertToProtoPulse', () => {
    it('converts components to nodes', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      const result = importer.convertToProtoPulse(design);
      expect(result.nodes.length).toBe(2);
      expect(result.nodes[0].label).toContain('R1');
      expect(result.nodes[0].id).toBeDefined();
      expect(result.nodes[0].type).toBe('resistor');
    });

    it('converts nets to edges', () => {
      const design = importer.parseEagleSchematic(eagleSchContent());
      const result = importer.convertToProtoPulse(design);
      // VCC net has 2 pins, so 1 edge
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
      expect(result.edges[0].label).toBe('VCC');
    });

    it('generates BOM items from components', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      const result = importer.convertToProtoPulse(design);
      expect(result.bomItems.length).toBe(2);
      expect(result.bomItems[0].quantity).toBe(1);
    });

    it('aggregates duplicate components in BOM', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      // Add a duplicate R component
      design.components.push({
        ...design.components[0],
        refDes: 'R2',
      });
      const result = importer.convertToProtoPulse(design);
      // R1 and R2 have the same name+package, so should be aggregated
      const rItem = result.bomItems.find((b) => b.name.includes('R'));
      expect(rItem).toBeDefined();
      expect(rItem!.quantity).toBe(2);
    });

    it('uses component position when available', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      const result = importer.convertToProtoPulse(design);
      expect(result.nodes[0].position).toEqual({ x: 100, y: 50 });
    });

    it('infers node type from refDes', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      const result = importer.convertToProtoPulse(design);
      expect(result.nodes[0].type).toBe('resistor');
      expect(result.nodes[1].type).toBe('capacitor');
    });

    it('handles empty design', () => {
      const design: ImportedDesign = {
        format: 'kicad-schematic',
        fileName: 'empty.kicad_sch',
        components: [],
        nets: [],
        wires: [],
        metadata: {},
        warnings: [],
        errors: [],
      };
      const result = importer.convertToProtoPulse(design);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.bomItems).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // validateImport
  // -----------------------------------------------------------------------

  describe('validateImport', () => {
    it('returns valid for a good design', () => {
      const design = importer.parseEagleSchematic(eagleSchContent());
      const result = importer.validateImport(design);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('warns about design with no components', () => {
      const design: ImportedDesign = {
        format: 'kicad-schematic',
        fileName: 'empty.kicad_sch',
        components: [],
        nets: [],
        wires: [],
        metadata: {},
        warnings: [],
        errors: [],
      };
      const result = importer.validateImport(design);
      expect(result.warnings).toContain('Design contains no components');
    });

    it('detects duplicate ref designators', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      // Add a duplicate
      design.components.push({
        ...design.components[0],
      });
      const result = importer.validateImport(design);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate reference designator'))).toBe(true);
    });

    it('detects orphan net references', () => {
      const design: ImportedDesign = {
        format: 'kicad-schematic',
        fileName: 'test.kicad_sch',
        components: [
          { refDes: 'R1', name: 'R', value: '10k', package: '', library: '', properties: {}, pins: [] },
        ],
        nets: [
          { name: 'VCC', pins: [{ componentRef: 'R1', pinNumber: '1' }, { componentRef: 'MISSING', pinNumber: '2' }] },
        ],
        wires: [],
        metadata: {},
        warnings: [],
        errors: [],
      };
      const result = importer.validateImport(design);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('MISSING'))).toBe(true);
    });

    it('warns about nets with no connections', () => {
      const design: ImportedDesign = {
        format: 'kicad-schematic',
        fileName: 'test.kicad_sch',
        components: [
          { refDes: 'R1', name: 'R', value: '10k', package: '', library: '', properties: {}, pins: [] },
        ],
        nets: [{ name: 'FLOATING', pins: [] }],
        wires: [],
        metadata: {},
        warnings: [],
        errors: [],
      };
      const result = importer.validateImport(design);
      expect(result.warnings.some((w) => w.includes('no connections'))).toBe(true);
    });

    it('warns about nets with only one connection', () => {
      const design: ImportedDesign = {
        format: 'kicad-schematic',
        fileName: 'test.kicad_sch',
        components: [
          { refDes: 'R1', name: 'R', value: '10k', package: '', library: '', properties: {}, pins: [] },
        ],
        nets: [{ name: 'STUB', pins: [{ componentRef: 'R1', pinNumber: '1' }] }],
        wires: [],
        metadata: {},
        warnings: [],
        errors: [],
      };
      const result = importer.validateImport(design);
      expect(result.warnings.some((w) => w.includes('only one connection'))).toBe(true);
    });

    it('warns about components without ref designators', () => {
      const design: ImportedDesign = {
        format: 'kicad-schematic',
        fileName: 'test.kicad_sch',
        components: [
          { refDes: '', name: 'R', value: '10k', package: '', library: '', properties: {}, pins: [] },
        ],
        nets: [],
        wires: [],
        metadata: {},
        warnings: [],
        errors: [],
      };
      const result = importer.validateImport(design);
      expect(result.warnings.some((w) => w.includes('without reference designators'))).toBe(true);
    });

    it('includes existing design errors and warnings', () => {
      const design: ImportedDesign = {
        format: 'kicad-schematic',
        fileName: 'test.kicad_sch',
        components: [{ refDes: 'R1', name: 'R', value: '10k', package: '', library: '', properties: {}, pins: [] }],
        nets: [],
        wires: [],
        metadata: {},
        warnings: ['pre-existing warning'],
        errors: ['pre-existing error'],
      };
      const result = importer.validateImport(design);
      expect(result.errors).toContain('pre-existing error');
      expect(result.warnings).toContain('pre-existing warning');
    });
  });

  // -----------------------------------------------------------------------
  // Import history
  // -----------------------------------------------------------------------

  describe('import history', () => {
    it('adds imports to history', () => {
      importer.importFile(kicadSchContent(), 'test1.kicad_sch');
      importer.importFile(eagleSchContent(), 'test2.sch');
      const history = importer.getImportHistory();
      expect(history.length).toBe(2);
    });

    it('returns a copy of history', () => {
      importer.importFile(kicadSchContent(), 'test.kicad_sch');
      const h1 = importer.getImportHistory();
      const h2 = importer.getImportHistory();
      expect(h1).not.toBe(h2);
      expect(h1).toEqual(h2);
    });

    it('clears history', () => {
      importer.importFile(kicadSchContent(), 'test.kicad_sch');
      expect(importer.getImportHistory().length).toBe(1);
      importer.clearHistory();
      expect(importer.getImportHistory().length).toBe(0);
    });

    it('records error imports in history', () => {
      importer.importFile('garbage', 'unknown.xyz');
      const history = importer.getImportHistory();
      expect(history.length).toBe(1);
      expect(history[0].status).toBe('error');
    });
  });

  // -----------------------------------------------------------------------
  // Supported formats
  // -----------------------------------------------------------------------

  describe('getSupportedFormats', () => {
    it('returns all supported formats', () => {
      const formats = importer.getSupportedFormats();
      expect(formats.length).toBe(8);
      const formatNames = formats.map((f) => f.format);
      expect(formatNames).toContain('kicad-schematic');
      expect(formatNames).toContain('kicad-pcb');
      expect(formatNames).toContain('kicad-symbol');
      expect(formatNames).toContain('eagle-schematic');
      expect(formatNames).toContain('eagle-board');
      expect(formatNames).toContain('eagle-library');
      expect(formatNames).toContain('altium-schematic');
      expect(formatNames).toContain('altium-pcb');
    });

    it('each format has extensions and description', () => {
      const formats = importer.getSupportedFormats();
      formats.forEach((f) => {
        expect(f.extensions.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThan(0);
      });
    });

    it('returns a copy (not the original)', () => {
      const f1 = importer.getSupportedFormats();
      const f2 = importer.getSupportedFormats();
      expect(f1).not.toBe(f2);
    });
  });

  // -----------------------------------------------------------------------
  // exportDesign
  // -----------------------------------------------------------------------

  describe('exportDesign', () => {
    it('serializes design to JSON', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      const json = importer.exportDesign(design);
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json) as ImportedDesign;
      expect(parsed.format).toBe('kicad-schematic');
      expect(parsed.components.length).toBe(design.components.length);
    });

    it('round-trips correctly', () => {
      const design = importer.parseEagleSchematic(eagleSchContent());
      const json = importer.exportDesign(design);
      const parsed = JSON.parse(json) as ImportedDesign;
      expect(parsed.components).toEqual(design.components);
      expect(parsed.nets).toEqual(design.nets);
      expect(parsed.wires).toEqual(design.wires);
    });
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('persists history to localStorage', () => {
      importer.importFile(kicadSchContent(), 'test.kicad_sch');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'protopulse-design-imports',
        expect.any(String),
      );
    });

    it('loads history from localStorage on init', () => {
      // Import something first
      importer.importFile(kicadSchContent(), 'test.kicad_sch');
      const savedData = store['protopulse-design-imports'];
      expect(savedData).toBeDefined();

      // Create new instance — should load from storage
      DesignImporter.resetForTesting();
      const newImporter = DesignImporter.getInstance();
      const history = newImporter.getImportHistory();
      expect(history.length).toBe(1);
    });

    it('handles corrupt localStorage gracefully', () => {
      store['protopulse-design-imports'] = 'not json!!!';
      DesignImporter.resetForTesting();
      const newImporter = DesignImporter.getInstance();
      expect(newImporter.getImportHistory().length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Error handling edge cases
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('handles malformed KiCad content gracefully', () => {
      const result = importer.importFile('(kicad_sch (broken', 'bad.kicad_sch');
      // Should not throw — returns a result (possibly with errors)
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('handles malformed EAGLE XML gracefully', () => {
      const result = importer.importFile('<eagle><broken>', 'bad.sch');
      expect(result).toBeDefined();
    });

    it('handles malformed Altium content gracefully', () => {
      const result = importer.importFile('|RECORD=unknown|', 'bad.SchDoc');
      expect(result).toBeDefined();
    });

    it('handles null-like content', () => {
      const result = importer.importFile('   ', 'empty.kicad_sch');
      expect(result.status).toBe('error');
    });

    it('single component design', () => {
      const content = `(kicad_sch (version 20211014)
        (symbol "U1"
          (lib_id "MCU:ATmega328P")
          (at 150 100)
          (property "Reference" "U1")
          (property "Value" "ATmega328P")
        )
      )`;
      const result = importer.importFile(content, 'single.kicad_sch');
      expect(result.status).toBe('complete');
      expect(result.componentCount).toBe(1);
    });

    it('design with no nets', () => {
      const content = `(kicad_sch (version 20211014)
        (symbol "R1"
          (lib_id "Device:R")
          (property "Reference" "R1")
          (property "Value" "1k")
        )
      )`;
      const result = importer.importFile(content, 'nonets.kicad_sch');
      expect(result.status).toBe('complete');
      expect(result.netCount).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Node type inference
  // -----------------------------------------------------------------------

  describe('node type inference', () => {
    it('infers resistor from R prefix', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      const result = importer.convertToProtoPulse(design);
      expect(result.nodes[0].type).toBe('resistor');
    });

    it('infers capacitor from C prefix', () => {
      const design = importer.parseKicadSchematic(kicadSchContent());
      const result = importer.convertToProtoPulse(design);
      expect(result.nodes[1].type).toBe('capacitor');
    });

    it('infers IC from U prefix', () => {
      const comp: ImportedComponent = {
        refDes: 'U1', name: 'ATmega328P', value: '', package: '', library: '', properties: {}, pins: [],
      };
      const design: ImportedDesign = {
        format: 'kicad-schematic', fileName: '', components: [comp], nets: [], wires: [], metadata: {}, warnings: [], errors: [],
      };
      const result = importer.convertToProtoPulse(design);
      expect(result.nodes[0].type).toBe('ic');
    });

    it('infers diode from D prefix', () => {
      const comp: ImportedComponent = {
        refDes: 'D1', name: '1N4148', value: '', package: '', library: '', properties: {}, pins: [],
      };
      const design: ImportedDesign = {
        format: 'kicad-schematic', fileName: '', components: [comp], nets: [], wires: [], metadata: {}, warnings: [], errors: [],
      };
      const result = importer.convertToProtoPulse(design);
      expect(result.nodes[0].type).toBe('diode');
    });

    it('infers connector from J prefix', () => {
      const comp: ImportedComponent = {
        refDes: 'J1', name: 'Conn_01x04', value: '', package: '', library: '', properties: {}, pins: [],
      };
      const design: ImportedDesign = {
        format: 'kicad-schematic', fileName: '', components: [comp], nets: [], wires: [], metadata: {}, warnings: [], errors: [],
      };
      const result = importer.convertToProtoPulse(design);
      expect(result.nodes[0].type).toBe('connector');
    });

    it('defaults to component for unknown prefix', () => {
      const comp: ImportedComponent = {
        refDes: 'Z1', name: 'SomeWidget', value: '', package: '', library: '', properties: {}, pins: [],
      };
      const design: ImportedDesign = {
        format: 'kicad-schematic', fileName: '', components: [comp], nets: [], wires: [], metadata: {}, warnings: [], errors: [],
      };
      const result = importer.convertToProtoPulse(design);
      expect(result.nodes[0].type).toBe('component');
    });
  });

  // -----------------------------------------------------------------------
  // Hook shape
  // -----------------------------------------------------------------------

  describe('useDesignImport hook', () => {
    it('returns the expected shape', () => {
      // Verify the hook function exists and is callable
      expect(typeof useDesignImport).toBe('function');
    });
  });
});
