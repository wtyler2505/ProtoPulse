import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useProject } from '@/lib/project-context';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface SchematicPin {
  name: string;
  x: number;
  y: number;
  side: 'left' | 'right' | 'top' | 'bottom';
  net?: string;
}

interface SchematicComponent {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pins: SchematicPin[];
  partNumber?: string;
  package?: string;
  specs?: Record<string, string>;
}

interface SchematicNet {
  id: string;
  name: string;
  points: { x: number; y: number }[];
  color?: string;
}

interface SheetData {
  components: SchematicComponent[];
  nets: SchematicNet[];
}

const topSheetData: SheetData = {
  components: [
    {
      id: 'esp32-top', name: 'ESP32-S3', type: 'MCU',
      x: 300, y: 200, width: 200, height: 150,
      pins: [
        { name: '3V3', x: -20, y: 30, side: 'left', net: 'VCC_3V3' },
        { name: 'GND', x: -20, y: 60, side: 'left', net: 'GND' },
        { name: 'MOSI', x: 220, y: 30, side: 'right', net: 'SPI_MOSI' },
        { name: 'MISO', x: 220, y: 50, side: 'right', net: 'SPI_MISO' },
        { name: 'SCK', x: 220, y: 70, side: 'right', net: 'SPI_SCK' },
        { name: 'CS', x: 220, y: 90, side: 'right', net: 'SPI_CS' },
      ],
      partNumber: 'ESP32-S3-WROOM-1', package: 'Module',
      specs: { 'CPU': 'Dual-core Xtensa LX7 @ 240MHz', 'Flash': '8MB', 'RAM': '512KB SRAM', 'WiFi': '802.11 b/g/n', 'BLE': '5.0', 'GPIO': '45 pins' },
    },
    {
      id: 'tp4056-top', name: 'TP4056', type: 'Charger IC',
      x: 50, y: 200, width: 100, height: 80,
      pins: [
        { name: 'OUT', x: 120, y: 30, side: 'right', net: 'VBAT' },
      ],
      partNumber: 'TP4056', package: 'SOP-8',
      specs: { 'Input': '4.5V-5.5V', 'Charge Current': '1A max', 'Charge Voltage': '4.2V' },
    },
    {
      id: 'sx1262-top', name: 'SX1262', type: 'LoRa Transceiver',
      x: 600, y: 200, width: 120, height: 100,
      pins: [
        { name: 'MOSI', x: -20, y: 30, side: 'left', net: 'SPI_MOSI' },
        { name: 'MISO', x: -20, y: 50, side: 'left', net: 'SPI_MISO' },
        { name: 'SCK', x: -20, y: 70, side: 'left', net: 'SPI_SCK' },
        { name: 'NSS', x: -20, y: 90, side: 'left', net: 'SPI_CS' },
      ],
      partNumber: 'SX1262IMLTRT', package: 'QFN-24',
      specs: { 'Frequency': '150MHz - 960MHz', 'Sensitivity': '-148 dBm', 'TX Power': '+22 dBm', 'Modulation': 'LoRa / FSK' },
    },
    {
      id: 'sht40-top', name: 'SHT40', type: 'Temp/Humidity Sensor',
      x: 300, y: 430, width: 120, height: 70,
      pins: [
        { name: 'SDA', x: -20, y: 25, side: 'left', net: 'I2C_SDA' },
        { name: 'SCL', x: -20, y: 50, side: 'left', net: 'I2C_SCL' },
        { name: 'VDD', x: 140, y: 25, side: 'right', net: 'VCC_3V3' },
        { name: 'GND', x: 140, y: 50, side: 'right', net: 'GND' },
      ],
      partNumber: 'SHT40-AD1B-R2', package: 'DFN-4',
      specs: { 'Temp Range': '-40°C to 125°C', 'Temp Accuracy': '±0.2°C', 'Humidity Range': '0-100% RH', 'Interface': 'I2C' },
    },
    {
      id: 'antenna-top', name: 'Antenna', type: 'LoRa Antenna',
      x: 650, y: 80, width: 80, height: 60,
      pins: [
        { name: 'RF', x: -20, y: 30, side: 'left', net: 'RF_OUT' },
      ],
      partNumber: 'ANT-868-USP410', package: 'SMA',
      specs: { 'Frequency': '868/915 MHz', 'Gain': '2 dBi', 'VSWR': '<2.0' },
    },
  ],
  nets: [
    { id: 'net-vbat-top', name: 'VBAT', points: [{ x: 170, y: 230 }, { x: 280, y: 230 }] },
    { id: 'net-spi-mosi', name: 'SPI_MOSI', points: [{ x: 520, y: 230 }, { x: 580, y: 230 }] },
    { id: 'net-spi-miso', name: 'SPI_MISO', points: [{ x: 520, y: 250 }, { x: 580, y: 250 }] },
    { id: 'net-spi-sck', name: 'SPI_SCK', points: [{ x: 520, y: 270 }, { x: 580, y: 270 }] },
    { id: 'net-spi-cs', name: 'SPI_CS', points: [{ x: 520, y: 290 }, { x: 580, y: 290 }] },
    { id: 'net-i2c-sda', name: 'I2C_SDA', points: [{ x: 280, y: 455 }, { x: 250, y: 455 }, { x: 250, y: 360 }, { x: 280, y: 360 }] },
    { id: 'net-i2c-scl', name: 'I2C_SCL', points: [{ x: 280, y: 480 }, { x: 230, y: 480 }, { x: 230, y: 380 }, { x: 280, y: 380 }] },
    { id: 'net-rf', name: 'RF_OUT', points: [{ x: 660, y: 300 }, { x: 660, y: 140 }, { x: 630, y: 110 }] },
  ],
};

const powerSheetData: SheetData = {
  components: [
    {
      id: 'usbc-pwr', name: 'USB-C', type: 'Connector',
      x: 80, y: 230, width: 100, height: 60,
      pins: [
        { name: 'VBUS', x: 120, y: 20, side: 'right', net: 'VBUS_5V' },
        { name: 'GND', x: 120, y: 40, side: 'right', net: 'GND' },
      ],
      partNumber: 'USB4110-GF-A', package: 'SMD',
      specs: { 'Voltage': '5V', 'Current': '3A max', 'Standard': 'USB 2.0' },
    },
    {
      id: 'tp4056-pwr', name: 'TP4056', type: 'Charger IC',
      x: 300, y: 210, width: 140, height: 100,
      pins: [
        { name: 'IN', x: -20, y: 20, side: 'left', net: 'VBUS_5V' },
        { name: 'GND', x: -20, y: 50, side: 'left', net: 'GND' },
        { name: 'BAT+', x: 160, y: 20, side: 'right', net: 'VBAT' },
        { name: 'OUT', x: 160, y: 50, side: 'right', net: 'VBAT' },
      ],
      partNumber: 'TP4056', package: 'SOP-8',
      specs: { 'Input': '4.5V-5.5V', 'Charge Current': '1A max', 'Charge Voltage': '4.2V', 'Standby Current': '<2µA' },
    },
    {
      id: 'lipo-pwr', name: 'Li-Po Battery', type: 'Battery',
      x: 560, y: 220, width: 120, height: 80,
      pins: [
        { name: 'BAT+', x: -20, y: 20, side: 'left', net: 'VBAT' },
        { name: 'BAT-', x: -20, y: 60, side: 'left', net: 'GND' },
      ],
      partNumber: 'LP-503759', package: '50x37x5.9mm',
      specs: { 'Voltage': '3.7V nominal', 'Capacity': '2000mAh', 'Max Discharge': '2C', 'Weight': '38g' },
    },
    {
      id: 'ldo-pwr', name: 'LDO 3.3V', type: 'Voltage Regulator',
      x: 360, y: 400, width: 120, height: 70,
      pins: [
        { name: 'VIN', x: -20, y: 25, side: 'left', net: 'VBAT' },
        { name: 'GND', x: 60, y: 90, side: 'bottom', net: 'GND' },
        { name: 'VOUT', x: 140, y: 25, side: 'right', net: 'VCC_3V3' },
      ],
      partNumber: 'AP2112K-3.3', package: 'SOT-23-5',
      specs: { 'Input': '2.5V-6V', 'Output': '3.3V', 'Max Current': '600mA', 'Dropout': '250mV @ 600mA', 'Quiescent': '55µA' },
    },
  ],
  nets: [
    { id: 'net-vbus', name: 'VBUS_5V', points: [{ x: 200, y: 250 }, { x: 280, y: 230 }], color: '#ef4444' },
    { id: 'net-gnd-pwr1', name: 'GND', points: [{ x: 200, y: 270 }, { x: 280, y: 260 }], color: '#3b82f6' },
    { id: 'net-vbat-pwr', name: 'VBAT', points: [{ x: 460, y: 230 }, { x: 540, y: 240 }] },
    { id: 'net-vbat-pwr2', name: 'VBAT', points: [{ x: 460, y: 260 }, { x: 480, y: 260 }, { x: 480, y: 425 }, { x: 340, y: 425 }] },
    { id: 'net-3v3-out', name: 'VCC_3V3', points: [{ x: 500, y: 425 }, { x: 560, y: 425 }, { x: 560, y: 370 }], color: '#22c55e' },
  ],
};

const mcuSheetData: SheetData = {
  components: [
    {
      id: 'esp32-mcu', name: 'ESP32-S3', type: 'MCU',
      x: 250, y: 130, width: 300, height: 300,
      pins: [
        { name: '3V3', x: -30, y: 40, side: 'left', net: 'VCC_3V3' },
        { name: 'GND', x: -30, y: 70, side: 'left', net: 'GND' },
        { name: 'EN', x: -30, y: 100, side: 'left', net: 'EN' },
        { name: 'IO0', x: -30, y: 130, side: 'left', net: 'BOOT' },
        { name: 'SDA', x: -30, y: 160, side: 'left', net: 'I2C_SDA' },
        { name: 'SCL', x: -30, y: 190, side: 'left', net: 'I2C_SCL' },
        { name: 'TX', x: -30, y: 220, side: 'left', net: 'UART_TX' },
        { name: 'RX', x: -30, y: 250, side: 'left', net: 'UART_RX' },
        { name: 'MOSI', x: 330, y: 40, side: 'right', net: 'SPI_MOSI' },
        { name: 'MISO', x: 330, y: 70, side: 'right', net: 'SPI_MISO' },
        { name: 'SCK', x: 330, y: 100, side: 'right', net: 'SPI_SCK' },
        { name: 'CS', x: 330, y: 130, side: 'right', net: 'SPI_CS' },
        { name: 'ADC1', x: 330, y: 160, side: 'right', net: 'ADC_CH1' },
        { name: 'ADC2', x: 330, y: 190, side: 'right', net: 'ADC_CH2' },
        { name: 'GPIO18', x: 330, y: 220, side: 'right', net: 'LED_STATUS' },
        { name: 'GPIO19', x: 330, y: 250, side: 'right', net: 'BUZZER' },
      ],
      partNumber: 'ESP32-S3-WROOM-1', package: 'Module (18x25.5mm)',
      specs: { 'CPU': 'Dual-core Xtensa LX7 @ 240MHz', 'Flash': '8MB', 'PSRAM': '2MB', 'RAM': '512KB SRAM', 'WiFi': '802.11 b/g/n', 'BLE': '5.0', 'USB': 'OTG', 'ADC': '2x 12-bit SAR' },
    },
    {
      id: 'decoupling-mcu', name: 'C1 100nF', type: 'Capacitor',
      x: 120, y: 140, width: 60, height: 40,
      pins: [
        { name: '+', x: 80, y: 15, side: 'right', net: 'VCC_3V3' },
        { name: '-', x: 80, y: 30, side: 'right', net: 'GND' },
      ],
      partNumber: 'CL05B104KO5NNNC', package: '0402',
      specs: { 'Capacitance': '100nF', 'Voltage': '16V', 'Dielectric': 'X5R' },
    },
    {
      id: 'pullup-en', name: 'R1 10K', type: 'Resistor',
      x: 130, y: 220, width: 60, height: 30,
      pins: [
        { name: '1', x: 80, y: 15, side: 'right', net: 'EN' },
        { name: '2', x: -20, y: 15, side: 'left', net: 'VCC_3V3' },
      ],
      partNumber: 'RC0402FR-0710KL', package: '0402',
      specs: { 'Resistance': '10KΩ', 'Tolerance': '1%', 'Power': '1/16W' },
    },
  ],
  nets: [
    { id: 'net-3v3-mcu', name: 'VCC_3V3', points: [{ x: 200, y: 155 }, { x: 220, y: 170 }], color: '#22c55e' },
    { id: 'net-gnd-mcu', name: 'GND', points: [{ x: 200, y: 170 }, { x: 220, y: 200 }], color: '#3b82f6' },
    { id: 'net-en', name: 'EN', points: [{ x: 210, y: 235 }, { x: 220, y: 230 }] },
  ],
};

const sheetDataMap: Record<string, SheetData> = {
  top: topSheetData,
  power: powerSheetData,
  mcu: mcuSheetData,
};

export default function SchematicView() {
  const { activeSheetId, schematicSheets, setActiveView, setActiveSheetId, addBomItem, addOutputLog } = useProject();

  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);

  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);
  const [hoveredNetId, setHoveredNetId] = useState<string | null>(null);
  const [netTooltip, setNetTooltip] = useState<{ x: number; y: number; name: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showPinLabels, setShowPinLabels] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  const sheetData = sheetDataMap[activeSheetId] || topSheetData;
  const components = sheetData.components;
  const nets = sheetData.nets;

  const filteredMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(components.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      (c.partNumber && c.partNumber.toLowerCase().includes(q))
    ).map(c => c.id));
  }, [searchQuery, components]);

  const selectedComponent = components.find(c => c.id === selectedComponentId) || null;

  useEffect(() => {
    setSelectedComponentId(null);
    setHoveredComponentId(null);
    setHoveredNetId(null);
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, [activeSheetId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpaceDown(true);
      }
      if (e.code === 'Escape') {
        setSelectedComponentId(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceDown(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.2), 5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - translateX, y: e.clientY - translateY });
    }
  }, [spaceDown, translateX, translateY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setTranslateX(e.clientX - panStart.x);
      setTranslateY(e.clientY - panStart.y);
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const fitToView = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  const zoomIn = useCallback(() => setScale(prev => Math.min(prev * 1.25, 5)), []);
  const zoomOut = useCallback(() => setScale(prev => Math.max(prev * 0.8, 0.2)), []);

  const handleComponentClick = useCallback((id: string) => {
    setSelectedComponentId(prev => prev === id ? null : id);
  }, []);

  const handleAddToBom = useCallback(() => {
    if (!selectedComponent) return;
    addBomItem({
      partNumber: selectedComponent.partNumber || selectedComponent.name,
      manufacturer: 'TBD',
      description: `${selectedComponent.name} - ${selectedComponent.type}`,
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      supplier: 'Digi-Key',
      stock: 0,
      status: 'In Stock',
    });
    addOutputLog(`[BOM] Added ${selectedComponent.name} (${selectedComponent.partNumber}) to BOM`);
  }, [selectedComponent, addBomItem, addOutputLog]);

  const handleViewInArchitecture = useCallback(() => {
    setActiveView('architecture');
  }, [setActiveView]);

  const handleNetHover = useCallback((netId: string | null, e?: React.MouseEvent) => {
    setHoveredNetId(netId);
    if (netId && e) {
      const net = nets.find(n => n.id === netId);
      if (net) {
        setNetTooltip({ x: e.clientX, y: e.clientY, name: net.name });
      }
    } else {
      setNetTooltip(null);
    }
  }, [nets]);

  const highlightedNetName = useMemo(() => {
    if (!hoveredNetId) return null;
    const net = nets.find(n => n.id === hoveredNetId);
    return net?.name || null;
  }, [hoveredNetId, nets]);

  const getNetHighlight = useCallback((net: SchematicNet) => {
    if (hoveredNetId === net.id) return true;
    if (highlightedNetName && net.name === highlightedNetName) return true;
    return false;
  }, [hoveredNetId, highlightedNetName]);

  const activeSheet = schematicSheets.find(s => s.id === activeSheetId);

  return (
    <div className="w-full h-full bg-[#1e1e1e] relative overflow-hidden flex" data-testid="schematic-view">
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: isPanning ? 'grabbing' : spaceDown ? 'grab' : 'default' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#4a4a4a 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <svg
          className="absolute inset-0 w-full h-full"
          style={{
            transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <defs>
            <filter id="glow-cyan">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-cyan-strong">
              <feGaussianBlur stdDeviation="6" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {nets.map(net => {
            const highlighted = getNetHighlight(net);
            const pathData = net.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            return (
              <path
                key={net.id}
                d={pathData}
                stroke={highlighted ? '#06b6d4' : net.color || '#6b7280'}
                strokeWidth={highlighted ? 3 : 1.5}
                fill="none"
                filter={highlighted ? 'url(#glow-cyan-strong)' : undefined}
                className="transition-all duration-150"
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => handleNetHover(net.id, e)}
                onMouseMove={(e) => { if (hoveredNetId === net.id) setNetTooltip({ x: e.clientX, y: e.clientY, name: net.name }); }}
                onMouseLeave={() => handleNetHover(null)}
                data-testid={`net-${net.id}`}
              />
            );
          })}

          {components.map(comp => {
            const isSelected = selectedComponentId === comp.id;
            const isHovered = hoveredComponentId === comp.id;
            const isSearchMatch = filteredMatchIds.has(comp.id);
            const dimmed = searchQuery.trim() && !isSearchMatch;

            return (
              <g
                key={comp.id}
                transform={`translate(${comp.x}, ${comp.y})`}
                onClick={() => handleComponentClick(comp.id)}
                onMouseEnter={() => setHoveredComponentId(comp.id)}
                onMouseLeave={() => setHoveredComponentId(null)}
                style={{ cursor: 'pointer', opacity: dimmed ? 0.25 : 1 }}
                className="transition-opacity duration-200"
                data-testid={`component-${comp.id}`}
              >
                {isSelected && (
                  <rect
                    x={-4} y={-4}
                    width={comp.width + 8} height={comp.height + 8}
                    fill="none" stroke="#06b6d4" strokeWidth="2"
                    filter="url(#glow-cyan)"
                  />
                )}
                <rect
                  x={0} y={0}
                  width={comp.width} height={comp.height}
                  fill={isHovered ? 'rgba(6,182,212,0.08)' : 'rgba(30,30,30,0.9)'}
                  stroke={isSelected ? '#06b6d4' : isSearchMatch ? '#06b6d4' : isHovered ? '#06b6d4' : '#6b7280'}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                  className="transition-all duration-150"
                />
                <text
                  x={comp.width / 2} y={comp.height / 2 - 5}
                  textAnchor="middle"
                  fill={isSelected ? '#06b6d4' : '#e5e5e5'}
                  className="font-mono"
                  fontSize="13"
                  fontWeight="bold"
                >
                  {comp.name}
                </text>
                <text
                  x={comp.width / 2} y={comp.height / 2 + 12}
                  textAnchor="middle"
                  fill="#9ca3af"
                  className="font-mono"
                  fontSize="9"
                >
                  {comp.type}
                </text>

                {comp.pins.map((pin, i) => {
                  const px = pin.side === 'left' ? 0 : pin.side === 'right' ? comp.width : pin.x;
                  const py = pin.side === 'top' ? 0 : pin.side === 'bottom' ? comp.height : pin.y;
                  const stubX = pin.side === 'left' ? pin.x : pin.side === 'right' ? pin.x : px;
                  const stubY = pin.side === 'top' ? pin.y : pin.side === 'bottom' ? pin.y : py;

                  return (
                    <g key={i}>
                      <line
                        x1={px} y1={py}
                        x2={stubX} y2={stubY}
                        stroke="#6b7280"
                        strokeWidth="1"
                      />
                      <circle cx={stubX} cy={stubY} r="2" fill="#06b6d4" opacity="0.7" />
                      {showPinLabels && (
                        <text
                          x={pin.side === 'left' ? stubX - 4 : pin.side === 'right' ? stubX + 4 : stubX}
                          y={pin.side === 'top' ? stubY - 4 : pin.side === 'bottom' ? stubY + 10 : stubY + 3}
                          textAnchor={pin.side === 'left' ? 'end' : pin.side === 'right' ? 'start' : 'middle'}
                          fill="#9ca3af"
                          className="font-mono"
                          fontSize="8"
                        >
                          {pin.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {netTooltip && (
          <div
            className="fixed z-50 px-2 py-1 bg-card/90 backdrop-blur border border-cyan-500/50 text-cyan-400 font-mono text-xs pointer-events-none"
            style={{ left: netTooltip.x + 12, top: netTooltip.y - 24 }}
          >
            NET: {netTooltip.name}
          </div>
        )}

        <TooltipProvider delayDuration={200}>
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-2" data-testid="toolbar">
            <div className="flex items-center gap-1 px-2 py-1 bg-card/70 backdrop-blur-xl border border-border">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={zoomIn} className="px-2 py-1 text-xs font-mono text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors" data-testid="btn-zoom-in">+</button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Zoom In</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={zoomOut} className="px-2 py-1 text-xs font-mono text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors" data-testid="btn-zoom-out">−</button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Zoom Out</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={fitToView} className="px-2 py-1 text-xs font-mono text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors" data-testid="btn-fit-view">FIT</button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Fit to View</p></TooltipContent>
              </Tooltip>
              <div className="w-px h-4 bg-border mx-1" />
              <span className="text-xs font-mono text-muted-foreground" data-testid="zoom-indicator">{Math.round(scale * 100)}%</span>
            </div>

            <div className="flex items-center gap-1 px-2 py-1 bg-card/70 backdrop-blur-xl border border-border">
              <span className="text-[10px] font-mono text-muted-foreground mr-1">SHEET:</span>
              <select
                value={activeSheetId}
                onChange={(e) => setActiveSheetId(e.target.value)}
                className="bg-transparent text-xs font-mono text-cyan-400 border-none outline-none cursor-pointer"
                data-testid="select-sheet"
              >
                {schematicSheets.map(s => (
                  <option key={s.id} value={s.id} className="bg-card text-foreground">{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 px-2 py-1 bg-card/70 backdrop-blur-xl border border-border">
              <span className="text-[10px] font-mono text-muted-foreground">COMPONENTS: {components.length}</span>
              <div className="w-px h-3 bg-border" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowPinLabels(prev => !prev)}
                    className={`text-[10px] font-mono transition-colors ${showPinLabels ? 'text-cyan-400' : 'text-muted-foreground'} hover:text-cyan-400`}
                    data-testid="btn-toggle-pins"
                  >
                    PINS {showPinLabels ? 'ON' : 'OFF'}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>{showPinLabels ? 'Hide' : 'Show'} Pin Labels</p></TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center px-2 py-1 bg-card/70 backdrop-blur-xl border border-border">
              <span className="text-[10px] font-mono text-muted-foreground mr-1">⌕</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search components..."
                className="bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground/50 w-36"
                data-testid="input-search"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-muted-foreground hover:text-cyan-400 ml-1"
                  data-testid="btn-clear-search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </TooltipProvider>
      </div>

      {selectedComponent && (
        <div
          className="w-80 h-full bg-card/80 backdrop-blur-xl border-l border-border overflow-y-auto flex-shrink-0 animate-in slide-in-from-right-5 duration-200"
          data-testid="inspection-panel"
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-mono font-bold text-cyan-400">{selectedComponent.name}</h3>
              <p className="text-xs font-mono text-muted-foreground">{selectedComponent.type}</p>
            </div>
            <button
              onClick={() => setSelectedComponentId(null)}
              className="text-muted-foreground hover:text-foreground text-lg leading-none px-1"
              data-testid="btn-close-panel"
            >
              ✕
            </button>
          </div>

          {selectedComponent.partNumber && (
            <div className="px-4 py-3 border-b border-border">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Part Number</div>
              <div className="text-xs font-mono text-foreground">{selectedComponent.partNumber}</div>
              {selectedComponent.package && (
                <>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1 mt-2">Package</div>
                  <div className="text-xs font-mono text-foreground">{selectedComponent.package}</div>
                </>
              )}
            </div>
          )}

          {selectedComponent.specs && Object.keys(selectedComponent.specs).length > 0 && (
            <div className="px-4 py-3 border-b border-border">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Specifications</div>
              <div className="space-y-1">
                {Object.entries(selectedComponent.specs).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-3 border-b border-border">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
              Pins ({selectedComponent.pins.length})
            </div>
            <div className="space-y-1">
              {selectedComponent.pins.map((pin, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-foreground">{pin.name}</span>
                  <span className="text-cyan-400/70">{pin.net || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3 border-b border-border">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Datasheet</div>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent((selectedComponent.partNumber || selectedComponent.name) + ' datasheet')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-cyan-400 hover:underline"
              data-testid="link-datasheet"
            >
              View Datasheet →
            </a>
          </div>

          <div className="px-4 py-3 space-y-2">
            <button
              onClick={handleAddToBom}
              className="w-full px-3 py-2 bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 text-xs font-mono hover:bg-cyan-400/20 transition-colors"
              data-testid="btn-add-to-bom"
            >
              + Add to BOM
            </button>
            <button
              onClick={handleViewInArchitecture}
              className="w-full px-3 py-2 bg-card border border-border text-muted-foreground text-xs font-mono hover:text-foreground hover:border-foreground/30 transition-colors"
              data-testid="btn-view-architecture"
            >
              View in Architecture →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}