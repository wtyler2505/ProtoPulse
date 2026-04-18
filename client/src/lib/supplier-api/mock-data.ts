/**
 * Supplier API — built-in mock part catalog (20 parts).
 * Split from supplier-api.ts. Returns realistic demo data when real API adapters aren't wired up.
 */

import type { DistributorId, DistributorOffer, PartSearchResult, PricingTier } from './types';

export function buildMockParts(): PartSearchResult[] {
  const now = Date.now();

  const mkOffer = (
    distId: DistributorId,
    distName: string,
    sku: string,
    stock: number,
    moq: number,
    packaging: string,
    pricing: PricingTier[],
    leadTimeDays: number | null = null,
  ): DistributorOffer => ({
    distributorId: distId,
    distributorName: distName,
    sku,
    stock,
    stockStatus: stock > 100 ? 'in-stock' : stock > 0 ? 'low-stock' : 'out-of-stock',
    leadTimeDays,
    moq,
    packaging,
    pricing,
    url: `https://${distId}.example.com/product/${sku}`,
    lastUpdated: now,
  });

  const usdTiers = (p1: number, p10: number, p100: number): PricingTier[] => [
    { minQuantity: 1, maxQuantity: 9, unitPrice: p1, currency: 'USD' },
    { minQuantity: 10, maxQuantity: 99, unitPrice: p10, currency: 'USD' },
    { minQuantity: 100, maxQuantity: null, unitPrice: p100, currency: 'USD' },
  ];

  return [
    {
      mpn: 'ATmega328P',
      manufacturer: 'Microchip Technology',
      description: '8-bit AVR Microcontroller, 32KB Flash, 2KB SRAM, 1KB EEPROM, 20MHz',
      category: 'Microcontrollers',
      datasheet: 'https://ww1.microchip.com/downloads/en/DeviceDoc/ATmega328P.pdf',
      lifecycle: 'active',
      specifications: { 'Flash': '32KB', 'SRAM': '2KB', 'Clock': '20MHz', 'Package': 'DIP-28' },
      offers: [
        mkOffer('digikey', 'DigiKey', 'ATMEGA328P-PU-ND', 4523, 1, 'tube', usdTiers(2.48, 2.21, 1.89)),
        mkOffer('mouser', 'Mouser Electronics', '556-ATMEGA328P-PU', 3180, 1, 'tube', usdTiers(2.52, 2.25, 1.92)),
        mkOffer('lcsc', 'LCSC Electronics', 'C14877', 12500, 1, 'tape-reel', usdTiers(1.95, 1.78, 1.55)),
      ],
    },
    {
      mpn: 'ESP32-WROOM-32',
      manufacturer: 'Espressif Systems',
      description: 'Wi-Fi + Bluetooth/BLE SoC Module, 4MB Flash, 240MHz Dual-Core',
      category: 'Wireless Modules',
      datasheet: 'https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf',
      lifecycle: 'active',
      specifications: { 'Flash': '4MB', 'CPU': 'Dual-Core 240MHz', 'Wi-Fi': '802.11 b/g/n', 'Bluetooth': '4.2 + BLE' },
      offers: [
        mkOffer('digikey', 'DigiKey', '1965-ESP32-WROOM-32-ND', 2890, 1, 'tray', usdTiers(3.10, 2.85, 2.45)),
        mkOffer('mouser', 'Mouser Electronics', '356-ESP32-WROOM-32', 1560, 1, 'tray', usdTiers(3.25, 2.95, 2.55)),
        mkOffer('lcsc', 'LCSC Electronics', 'C82899', 45000, 1, 'tape-reel', usdTiers(2.50, 2.20, 1.90)),
      ],
    },
    {
      mpn: 'LM7805',
      manufacturer: 'Texas Instruments',
      description: '5V 1.5A Fixed Positive Voltage Regulator, TO-220',
      category: 'Voltage Regulators',
      datasheet: 'https://www.ti.com/lit/ds/symlink/lm7805.pdf',
      lifecycle: 'active',
      specifications: { 'Output Voltage': '5V', 'Max Current': '1.5A', 'Package': 'TO-220', 'Dropout': '2V' },
      offers: [
        mkOffer('digikey', 'DigiKey', '296-LM7805CT-ND', 8700, 1, 'bulk', usdTiers(0.58, 0.52, 0.42)),
        mkOffer('mouser', 'Mouser Electronics', '511-LM7805CT', 6200, 1, 'bulk', usdTiers(0.61, 0.55, 0.44)),
        mkOffer('newark', 'Newark', '96K3112', 3400, 1, 'bulk', usdTiers(0.63, 0.56, 0.45)),
      ],
    },
    {
      mpn: 'NE555',
      manufacturer: 'Texas Instruments',
      description: 'Precision Timer IC, DIP-8',
      category: 'Timers & Oscillators',
      datasheet: 'https://www.ti.com/lit/ds/symlink/ne555.pdf',
      lifecycle: 'active',
      specifications: { 'Supply Voltage': '4.5V-16V', 'Timing': 'Microseconds to Hours', 'Package': 'DIP-8' },
      offers: [
        mkOffer('digikey', 'DigiKey', '296-NE555P-ND', 15200, 1, 'tube', usdTiers(0.42, 0.37, 0.29)),
        mkOffer('mouser', 'Mouser Electronics', '595-NE555P', 9800, 1, 'tube', usdTiers(0.45, 0.39, 0.31)),
        mkOffer('lcsc', 'LCSC Electronics', 'C46932', 52000, 1, 'tape-reel', usdTiers(0.03, 0.025, 0.02)),
      ],
    },
    {
      mpn: 'LM358',
      manufacturer: 'Texas Instruments',
      description: 'Dual Operational Amplifier, DIP-8',
      category: 'Op Amps',
      datasheet: 'https://www.ti.com/lit/ds/symlink/lm358.pdf',
      lifecycle: 'active',
      specifications: { 'Channels': '2', 'GBW': '1.1MHz', 'Supply': '3V-32V', 'Package': 'DIP-8' },
      offers: [
        mkOffer('digikey', 'DigiKey', '296-LM358P-ND', 11300, 1, 'tube', usdTiers(0.48, 0.42, 0.35)),
        mkOffer('mouser', 'Mouser Electronics', '595-LM358P', 7600, 1, 'tube', usdTiers(0.50, 0.44, 0.36)),
      ],
    },
    {
      mpn: 'RC0805FR-0710KL',
      manufacturer: 'Yageo',
      description: '10kΩ Resistor, 0805, 1%, 1/8W',
      category: 'Resistors',
      lifecycle: 'active',
      specifications: { 'Resistance': '10kΩ', 'Tolerance': '1%', 'Power': '0.125W', 'Package': '0805' },
      offers: [
        mkOffer('digikey', 'DigiKey', '311-10.0KCRCT-ND', 890000, 1, 'cut-tape', usdTiers(0.01, 0.005, 0.002)),
        mkOffer('lcsc', 'LCSC Electronics', 'C17414', 2500000, 100, 'tape-reel', usdTiers(0.001, 0.0008, 0.0005)),
      ],
    },
    {
      mpn: 'CL21B104KBCNNNC',
      manufacturer: 'Samsung Electro-Mechanics',
      description: '100nF Ceramic Capacitor, 0805, 50V, X7R',
      category: 'Capacitors',
      lifecycle: 'active',
      specifications: { 'Capacitance': '100nF', 'Voltage': '50V', 'Dielectric': 'X7R', 'Package': '0805' },
      offers: [
        mkOffer('digikey', 'DigiKey', '1276-1003-1-ND', 750000, 1, 'cut-tape', usdTiers(0.01, 0.006, 0.003)),
        mkOffer('mouser', 'Mouser Electronics', '187-CL21B104KBCN', 420000, 1, 'cut-tape', usdTiers(0.012, 0.007, 0.004)),
        mkOffer('lcsc', 'LCSC Electronics', 'C49678', 3100000, 100, 'tape-reel', usdTiers(0.002, 0.001, 0.0008)),
      ],
    },
    {
      mpn: 'GRM21BR61E106KA73L',
      manufacturer: 'Murata',
      description: '10µF Ceramic Capacitor, 0805, 25V, X5R',
      category: 'Capacitors',
      lifecycle: 'active',
      specifications: { 'Capacitance': '10µF', 'Voltage': '25V', 'Dielectric': 'X5R', 'Package': '0805' },
      offers: [
        mkOffer('digikey', 'DigiKey', '490-GRM21BR61E106KA73-ND', 125000, 1, 'cut-tape', usdTiers(0.12, 0.08, 0.05)),
        mkOffer('mouser', 'Mouser Electronics', '81-GRM21BR61E106KA3', 88000, 1, 'cut-tape', usdTiers(0.14, 0.09, 0.06)),
      ],
    },
    {
      mpn: '1N4148',
      manufacturer: 'ON Semiconductor',
      description: 'Small Signal Fast Switching Diode, DO-35',
      category: 'Diodes',
      datasheet: 'https://www.onsemi.com/pdf/datasheet/1n4148-d.pdf',
      lifecycle: 'active',
      specifications: { 'Vr': '100V', 'If': '200mA', 'trr': '4ns', 'Package': 'DO-35' },
      offers: [
        mkOffer('digikey', 'DigiKey', '1N4148FS-ND', 320000, 1, 'bulk', usdTiers(0.04, 0.03, 0.02)),
        mkOffer('mouser', 'Mouser Electronics', '512-1N4148', 180000, 1, 'bulk', usdTiers(0.05, 0.035, 0.025)),
        mkOffer('lcsc', 'LCSC Electronics', 'C14516', 1200000, 100, 'tape-reel', usdTiers(0.005, 0.003, 0.002)),
      ],
    },
    {
      mpn: 'LTST-C171KRKT',
      manufacturer: 'Lite-On',
      description: 'Red LED, 0805, 2V 20mA, 645nm',
      category: 'LEDs',
      lifecycle: 'active',
      specifications: { 'Color': 'Red', 'Wavelength': '645nm', 'Vf': '2V', 'If': '20mA', 'Package': '0805' },
      offers: [
        mkOffer('digikey', 'DigiKey', '160-1427-1-ND', 450000, 1, 'cut-tape', usdTiers(0.08, 0.06, 0.04)),
        mkOffer('mouser', 'Mouser Electronics', '859-LTST-C171KRKT', 210000, 1, 'cut-tape', usdTiers(0.09, 0.065, 0.045)),
      ],
    },
    {
      mpn: 'LTST-C171GKT',
      manufacturer: 'Lite-On',
      description: 'Green LED, 0805, 2.2V 20mA, 574nm',
      category: 'LEDs',
      lifecycle: 'active',
      specifications: { 'Color': 'Green', 'Wavelength': '574nm', 'Vf': '2.2V', 'If': '20mA', 'Package': '0805' },
      offers: [
        mkOffer('digikey', 'DigiKey', '160-1424-1-ND', 380000, 1, 'cut-tape', usdTiers(0.08, 0.06, 0.04)),
        mkOffer('lcsc', 'LCSC Electronics', 'C72044', 950000, 100, 'tape-reel', usdTiers(0.008, 0.005, 0.003)),
      ],
    },
    {
      mpn: 'USB4110-GF-A',
      manufacturer: 'Global Connector Technology',
      description: 'USB Type-C Receptacle, 24-Pin, Mid-Mount, SMD',
      category: 'Connectors',
      lifecycle: 'active',
      specifications: { 'Type': 'USB-C', 'Mounting': 'SMD', 'Pins': '24', 'Current': '5A' },
      offers: [
        mkOffer('digikey', 'DigiKey', '2073-USB4110-GF-ACT-ND', 8900, 1, 'tape-reel', usdTiers(0.65, 0.55, 0.42)),
        mkOffer('lcsc', 'LCSC Electronics', 'C2927038', 35000, 10, 'tape-reel', usdTiers(0.48, 0.38, 0.30)),
      ],
    },
    {
      mpn: 'PJ-102AH',
      manufacturer: 'CUI Devices',
      description: 'DC Barrel Jack, 2.1mm, Through-Hole, Right Angle',
      category: 'Connectors',
      lifecycle: 'active',
      specifications: { 'Inner Diameter': '2.1mm', 'Outer Diameter': '5.5mm', 'Rating': '5A/24V', 'Mounting': 'THT' },
      offers: [
        mkOffer('digikey', 'DigiKey', 'CP-102AH-ND', 12400, 1, 'bulk', usdTiers(0.83, 0.72, 0.58)),
        mkOffer('mouser', 'Mouser Electronics', '490-PJ-102AH', 6800, 1, 'bulk', usdTiers(0.87, 0.75, 0.61)),
      ],
    },
    {
      mpn: 'IRF540N',
      manufacturer: 'Infineon Technologies',
      description: 'N-Channel MOSFET, 100V, 33A, TO-220',
      category: 'MOSFETs',
      datasheet: 'https://www.infineon.com/dgdl/irf540n.pdf',
      lifecycle: 'active',
      specifications: { 'Vds': '100V', 'Id': '33A', 'Rds(on)': '44mΩ', 'Package': 'TO-220' },
      offers: [
        mkOffer('digikey', 'DigiKey', 'IRF540NPBF-ND', 5600, 1, 'bulk', usdTiers(1.15, 1.02, 0.85)),
        mkOffer('mouser', 'Mouser Electronics', '942-IRF540NPBF', 3200, 1, 'bulk', usdTiers(1.22, 1.08, 0.90)),
        mkOffer('arrow', 'Arrow Electronics', 'IRF540NPBF', 9800, 1, 'bulk', usdTiers(1.10, 0.98, 0.82)),
      ],
    },
    {
      mpn: 'TL072',
      manufacturer: 'Texas Instruments',
      description: 'Low-Noise JFET-Input Dual Op Amp, DIP-8',
      category: 'Op Amps',
      datasheet: 'https://www.ti.com/lit/ds/symlink/tl072.pdf',
      lifecycle: 'active',
      specifications: { 'Channels': '2', 'GBW': '3MHz', 'Slew Rate': '13V/µs', 'Package': 'DIP-8' },
      offers: [
        mkOffer('digikey', 'DigiKey', '296-TL072CP-ND', 7800, 1, 'tube', usdTiers(0.72, 0.62, 0.50)),
        mkOffer('mouser', 'Mouser Electronics', '595-TL072CP', 4500, 1, 'tube', usdTiers(0.75, 0.65, 0.52)),
      ],
    },
    {
      mpn: 'A000005',
      manufacturer: 'Arduino',
      description: 'Arduino Nano, ATmega328, 16MHz, Mini-B USB',
      category: 'Development Boards',
      lifecycle: 'active',
      specifications: { 'MCU': 'ATmega328', 'Clock': '16MHz', 'Digital I/O': '22', 'Analog In': '8' },
      offers: [
        mkOffer('digikey', 'DigiKey', '1050-1001-ND', 890, 1, 'bulk', usdTiers(23.90, 21.50, 19.80)),
        mkOffer('mouser', 'Mouser Electronics', '782-A000005', 340, 1, 'bulk', usdTiers(24.50, 22.00, 20.20)),
      ],
    },
    {
      mpn: '74HC595',
      manufacturer: 'NXP Semiconductors',
      description: '8-Bit Shift Register with Output Latches, DIP-16',
      category: 'Logic ICs',
      lifecycle: 'active',
      specifications: { 'Type': 'Shift Register', 'Bits': '8', 'Supply': '2V-6V', 'Package': 'DIP-16' },
      offers: [
        mkOffer('digikey', 'DigiKey', '1727-74HC595N-ND', 22000, 1, 'tube', usdTiers(0.38, 0.32, 0.25)),
        mkOffer('mouser', 'Mouser Electronics', '771-74HC595N', 14500, 1, 'tube', usdTiers(0.40, 0.34, 0.27)),
        mkOffer('lcsc', 'LCSC Electronics', 'C5947', 180000, 1, 'tape-reel', usdTiers(0.05, 0.035, 0.025)),
      ],
    },
    {
      mpn: 'AMS1117-3.3',
      manufacturer: 'Advanced Monolithic Systems',
      description: '3.3V 1A LDO Voltage Regulator, SOT-223',
      category: 'Voltage Regulators',
      lifecycle: 'active',
      specifications: { 'Output Voltage': '3.3V', 'Max Current': '1A', 'Dropout': '1.3V', 'Package': 'SOT-223' },
      offers: [
        mkOffer('digikey', 'DigiKey', 'AMS1117-3.3-ND', 35000, 1, 'tape-reel', usdTiers(0.25, 0.20, 0.15)),
        mkOffer('lcsc', 'LCSC Electronics', 'C6186', 520000, 20, 'tape-reel', usdTiers(0.03, 0.02, 0.015)),
      ],
    },
    {
      mpn: 'BME280',
      manufacturer: 'Bosch Sensortec',
      description: 'Humidity, Pressure, Temperature Sensor, LGA-8',
      category: 'Sensors',
      datasheet: 'https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bme280-ds002.pdf',
      lifecycle: 'active',
      specifications: { 'Humidity Range': '0-100%', 'Pressure Range': '300-1100hPa', 'Temperature': '-40 to +85°C', 'Interface': 'I2C/SPI' },
      offers: [
        mkOffer('digikey', 'DigiKey', '828-BME280-ND', 2100, 1, 'tape-reel', usdTiers(3.25, 2.90, 2.55)),
        mkOffer('mouser', 'Mouser Electronics', '262-BME280', 1400, 1, 'tape-reel', usdTiers(3.40, 3.05, 2.68)),
      ],
    },
    {
      mpn: 'INA219',
      manufacturer: 'Texas Instruments',
      description: 'Bidirectional Current/Power Monitor, I2C, MSOP-10',
      category: 'Sensors',
      datasheet: 'https://www.ti.com/lit/ds/symlink/ina219.pdf',
      lifecycle: 'active',
      specifications: { 'Bus Voltage': '0-26V', 'Shunt Voltage': '±320mV', 'Interface': 'I2C', 'Package': 'MSOP-10' },
      offers: [
        mkOffer('digikey', 'DigiKey', '296-INA219AIDR-ND', 6300, 1, 'tape-reel', usdTiers(1.45, 1.28, 1.05)),
        mkOffer('mouser', 'Mouser Electronics', '595-INA219AIDR', 4100, 1, 'tape-reel', usdTiers(1.52, 1.35, 1.10)),
        mkOffer('arrow', 'Arrow Electronics', 'INA219AIDR', 8500, 1, 'tape-reel', usdTiers(1.38, 1.22, 1.00)),
      ],
    },
  ];
}
