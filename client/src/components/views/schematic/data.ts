export interface SchematicPin {
  name: string;
  x: number;
  y: number;
  side: 'left' | 'right' | 'top' | 'bottom';
  net?: string;
}

export interface SchematicComponent {
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

export interface SchematicNet {
  id: string;
  name: string;
  points: { x: number; y: number }[];
  color?: string;
}

export interface SheetData {
  components: SchematicComponent[];
  nets: SchematicNet[];
}

export const topSheetData: SheetData = {
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

export const powerSheetData: SheetData = {
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

export const mcuSheetData: SheetData = {
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

export const sheetDataMap: Record<string, SheetData> = {
  top: topSheetData,
  power: powerSheetData,
  mcu: mcuSheetData,
};
