/**
 * Supplier API Integration Layer
 *
 * Client-side abstraction for real-time component pricing, stock, and lead times
 * from major electronic component distributors. Provides a unified interface with
 * caching, rate limiting, currency conversion, stock alerts, and mock/demo data.
 *
 * Actual API calls would go through a server proxy (not implemented here).
 * This layer defines the interface and provides realistic demo data for development.
 *
 * Usage:
 *   const api = SupplierApiManager.getInstance();
 *   const results = api.searchPart('ATmega328P');
 *   const quote = api.quoteBom([{ mpn: 'ATmega328P', quantity: 10 }]);
 *
 * React hook:
 *   const { searchPart, quoteBom, distributors } = useSupplierApi();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DistributorId = 'octopart' | 'digikey' | 'mouser' | 'newark' | 'arrow' | 'lcsc' | 'farnell';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY';
export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock' | 'on-order' | 'discontinued' | 'unknown';

export interface PricingTier {
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  currency: Currency;
}

export interface DistributorOffer {
  distributorId: DistributorId;
  distributorName: string;
  sku: string;
  stock: number;
  stockStatus: StockStatus;
  leadTimeDays: number | null;
  moq: number;
  packaging: string;
  pricing: PricingTier[];
  url: string;
  lastUpdated: number;
}

export interface PartSearchResult {
  mpn: string;
  manufacturer: string;
  description: string;
  category: string;
  datasheet?: string;
  lifecycle: 'active' | 'nrnd' | 'eol' | 'obsolete' | 'unknown';
  specifications: Record<string, string>;
  offers: DistributorOffer[];
  imageUrl?: string;
}

export interface SupplierConfig {
  distributorId: DistributorId;
  name: string;
  enabled: boolean;
  apiKeyRequired: boolean;
  rateLimit: number;
  baseUrl: string;
  regions: string[];
}

export interface SearchOptions {
  distributors?: DistributorId[];
  inStockOnly?: boolean;
  currency?: Currency;
  maxResults?: number;
  sortBy?: 'price' | 'stock' | 'leadTime' | 'relevance';
}

export interface BomPricingResult {
  mpn: string;
  quantity: number;
  bestPrice: { distributor: DistributorId; unitPrice: number; totalPrice: number; sku: string } | null;
  allOffers: DistributorOffer[];
  inStock: boolean;
  warnings: string[];
}

export interface BomQuote {
  items: BomPricingResult[];
  totalCost: number;
  currency: Currency;
  itemsFound: number;
  itemsMissing: number;
  timestamp: number;
}

export interface CachedSearch {
  query: string;
  results: PartSearchResult[];
  timestamp: number;
  expiresAt: number;
}

interface StockAlert {
  mpn: string;
  threshold: number;
}

interface RateLimitState {
  requests: number[];
}

interface PersistedState {
  enabledDistributors: DistributorId[];
  currency: Currency;
  cacheExpiryMs: number;
  stockAlerts: StockAlert[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-supplier-api';
const DEFAULT_CACHE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// ---------------------------------------------------------------------------
// Currency conversion rates (approximate, hardcoded)
// ---------------------------------------------------------------------------

const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149,
  CNY: 7.24,
};

// ---------------------------------------------------------------------------
// Built-in distributor configurations
// ---------------------------------------------------------------------------

const DEFAULT_DISTRIBUTORS: SupplierConfig[] = [
  {
    distributorId: 'digikey',
    name: 'DigiKey',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 60,
    baseUrl: 'https://api.digikey.com/v3',
    regions: ['US', 'EU', 'APAC'],
  },
  {
    distributorId: 'mouser',
    name: 'Mouser Electronics',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 30,
    baseUrl: 'https://api.mouser.com/api/v2',
    regions: ['US', 'EU', 'APAC'],
  },
  {
    distributorId: 'octopart',
    name: 'Octopart / Nexar',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 100,
    baseUrl: 'https://octopart.com/api/v4',
    regions: ['US', 'EU', 'APAC'],
  },
  {
    distributorId: 'newark',
    name: 'Newark',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 30,
    baseUrl: 'https://api.newark.com/v1',
    regions: ['US', 'EU'],
  },
  {
    distributorId: 'arrow',
    name: 'Arrow Electronics',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 45,
    baseUrl: 'https://api.arrow.com/itemservice/v4',
    regions: ['US', 'EU', 'APAC'],
  },
  {
    distributorId: 'lcsc',
    name: 'LCSC Electronics',
    enabled: true,
    apiKeyRequired: false,
    rateLimit: 120,
    baseUrl: 'https://www.lcsc.com/api/v1',
    regions: ['APAC', 'US'],
  },
  {
    distributorId: 'farnell',
    name: 'Farnell / element14',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 30,
    baseUrl: 'https://api.element14.com/catalog/products',
    regions: ['EU', 'APAC'],
  },
];

// ---------------------------------------------------------------------------
// Built-in mock part data (20 parts)
// ---------------------------------------------------------------------------

function buildMockParts(): PartSearchResult[] {
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

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// SupplierApiManager
// ---------------------------------------------------------------------------

/**
 * Manages supplier API interactions with caching, rate limiting, stock alerts,
 * and currency conversion. Singleton per application.
 * Notifies subscribers on state changes. Persists configuration to localStorage.
 */
export class SupplierApiManager {
  private static instance: SupplierApiManager | null = null;

  private distributors: SupplierConfig[];
  private mockParts: PartSearchResult[];
  private cache: Map<string, CachedSearch>;
  private cacheExpiryMs: number;
  private rateLimits: Map<DistributorId, RateLimitState>;
  private stockAlerts: StockAlert[];
  private currentCurrency: Currency;
  private listeners = new Set<Listener>();

  constructor() {
    this.distributors = DEFAULT_DISTRIBUTORS.map((d) => ({ ...d }));
    this.mockParts = buildMockParts();
    this.cache = new Map();
    this.cacheExpiryMs = DEFAULT_CACHE_EXPIRY_MS;
    this.rateLimits = new Map();
    this.stockAlerts = [];
    this.currentCurrency = 'USD';
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): SupplierApiManager {
    if (!SupplierApiManager.instance) {
      SupplierApiManager.instance = new SupplierApiManager();
    }
    return SupplierApiManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    SupplierApiManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Distributor Management
  // -----------------------------------------------------------------------

  /** Get all distributor configurations. */
  getDistributors(): SupplierConfig[] {
    return this.distributors.map((d) => ({ ...d }));
  }

  /** Get a single distributor configuration. */
  getDistributor(id: DistributorId): SupplierConfig | undefined {
    const d = this.distributors.find((d) => d.distributorId === id);
    return d ? { ...d } : undefined;
  }

  /** Enable a distributor. */
  enableDistributor(id: DistributorId): void {
    const d = this.distributors.find((d) => d.distributorId === id);
    if (d && !d.enabled) {
      d.enabled = true;
      this.save();
      this.notify();
    }
  }

  /** Disable a distributor. */
  disableDistributor(id: DistributorId): void {
    const d = this.distributors.find((d) => d.distributorId === id);
    if (d && d.enabled) {
      d.enabled = false;
      this.save();
      this.notify();
    }
  }

  /** Check if a distributor is enabled. */
  isEnabled(id: DistributorId): boolean {
    const d = this.distributors.find((d) => d.distributorId === id);
    return d?.enabled ?? false;
  }

  // -----------------------------------------------------------------------
  // Part Search
  // -----------------------------------------------------------------------

  /** Search for a part by manufacturer part number (MPN). */
  searchPart(mpn: string, options?: SearchOptions): PartSearchResult[] {
    if (!mpn.trim()) {
      return [];
    }

    // Check cache
    const cacheKey = `mpn:${mpn.toLowerCase()}`;
    const cached = this.getCachedSearch(cacheKey);
    if (cached) {
      return this.applySearchOptions(cached.results, options);
    }

    // Record rate limit hit for all enabled distributors
    const enabledDists = this.getEnabledDistributorIds(options?.distributors);
    enabledDists.forEach((distId) => {
      this.recordRequest(distId);
    });

    const mpnLower = mpn.toLowerCase();
    let results = this.mockParts.filter((p) => p.mpn.toLowerCase().includes(mpnLower));
    results = this.applySearchOptions(results, options);

    // Cache the results
    const now = Date.now();
    this.cache.set(cacheKey, {
      query: cacheKey,
      results,
      timestamp: now,
      expiresAt: now + this.cacheExpiryMs,
    });

    return results;
  }

  /** Search for parts by keyword (matches MPN, manufacturer, description, category). */
  searchByKeyword(keyword: string, options?: SearchOptions): PartSearchResult[] {
    if (!keyword.trim()) {
      return [];
    }

    const cacheKey = `kw:${keyword.toLowerCase()}`;
    const cached = this.getCachedSearch(cacheKey);
    if (cached) {
      return this.applySearchOptions(cached.results, options);
    }

    const enabledDists = this.getEnabledDistributorIds(options?.distributors);
    enabledDists.forEach((distId) => {
      this.recordRequest(distId);
    });

    const kwLower = keyword.toLowerCase();
    let results = this.mockParts.filter(
      (p) =>
        p.mpn.toLowerCase().includes(kwLower) ||
        p.manufacturer.toLowerCase().includes(kwLower) ||
        p.description.toLowerCase().includes(kwLower) ||
        p.category.toLowerCase().includes(kwLower),
    );
    results = this.applySearchOptions(results, options);

    const now = Date.now();
    this.cache.set(cacheKey, {
      query: cacheKey,
      results,
      timestamp: now,
      expiresAt: now + this.cacheExpiryMs,
    });

    return results;
  }

  // -----------------------------------------------------------------------
  // Pricing
  // -----------------------------------------------------------------------

  /** Get the best price for a part across enabled distributors. */
  getBestPrice(
    mpn: string,
    quantity: number,
    options?: SearchOptions,
  ): { distributor: DistributorId; unitPrice: number; totalPrice: number } | null {
    const results = this.searchPart(mpn, options);
    if (results.length === 0) {
      return null;
    }

    const part = results[0];
    let bestOffer: { distributor: DistributorId; unitPrice: number; totalPrice: number } | null = null;

    const enabledDists = this.getEnabledDistributorIds(options?.distributors);

    part.offers.forEach((offer) => {
      if (!enabledDists.includes(offer.distributorId)) {
        return;
      }
      if (options?.inStockOnly && offer.stockStatus === 'out-of-stock') {
        return;
      }

      const tierPrice = this.getPriceForQuantity(offer.pricing, quantity);
      if (tierPrice === null) {
        return;
      }

      const convertedPrice = this.convertCurrency(tierPrice, 'USD', this.currentCurrency);
      const totalPrice = convertedPrice * quantity;

      if (!bestOffer || convertedPrice < bestOffer.unitPrice) {
        bestOffer = {
          distributor: offer.distributorId,
          unitPrice: convertedPrice,
          totalPrice,
        };
      }
    });

    return bestOffer;
  }

  /** Get pricing tiers for a part from a specific distributor. */
  getPricingTiers(mpn: string, distributorId: DistributorId): PricingTier[] {
    const results = this.searchPart(mpn);
    if (results.length === 0) {
      return [];
    }

    const part = results[0];
    const offer = part.offers.find((o) => o.distributorId === distributorId);
    if (!offer) {
      return [];
    }

    return offer.pricing.map((t) => ({ ...t }));
  }

  // -----------------------------------------------------------------------
  // BOM Quoting
  // -----------------------------------------------------------------------

  /** Quote an entire BOM — find best prices for each line item. */
  quoteBom(items: Array<{ mpn: string; quantity: number }>, options?: SearchOptions): BomQuote {
    const currency = options?.currency ?? this.currentCurrency;
    const bomItems: BomPricingResult[] = items.map((item) => {
      const results = this.searchPart(item.mpn, options);
      const warnings: string[] = [];

      if (results.length === 0) {
        return {
          mpn: item.mpn,
          quantity: item.quantity,
          bestPrice: null,
          allOffers: [],
          inStock: false,
          warnings: [`Part "${item.mpn}" not found in any distributor`],
        };
      }

      const part = results[0];
      const enabledDists = this.getEnabledDistributorIds(options?.distributors);
      const filteredOffers = part.offers.filter((o) => enabledDists.includes(o.distributorId));

      // Check stock
      const hasStock = filteredOffers.some((o) => o.stock >= item.quantity);
      if (!hasStock) {
        const anyStock = filteredOffers.some((o) => o.stock > 0);
        if (anyStock) {
          warnings.push(`Insufficient stock for quantity ${item.quantity}`);
        } else {
          warnings.push('Out of stock at all distributors');
        }
      }

      // Check lifecycle
      if (part.lifecycle === 'nrnd') {
        warnings.push('Part is Not Recommended for New Designs (NRND)');
      } else if (part.lifecycle === 'eol') {
        warnings.push('Part is End of Life (EOL)');
      } else if (part.lifecycle === 'obsolete') {
        warnings.push('Part is obsolete');
      }

      // Find best price
      let bestPrice: BomPricingResult['bestPrice'] = null;

      filteredOffers.forEach((offer) => {
        if (options?.inStockOnly && offer.stockStatus === 'out-of-stock') {
          return;
        }

        const tierPrice = this.getPriceForQuantity(offer.pricing, item.quantity);
        if (tierPrice === null) {
          return;
        }

        const convertedPrice = this.convertCurrency(tierPrice, 'USD', currency);
        const totalPrice = convertedPrice * item.quantity;

        if (!bestPrice || convertedPrice < bestPrice.unitPrice) {
          bestPrice = {
            distributor: offer.distributorId,
            unitPrice: convertedPrice,
            totalPrice,
            sku: offer.sku,
          };
        }
      });

      return {
        mpn: item.mpn,
        quantity: item.quantity,
        bestPrice,
        allOffers: filteredOffers,
        inStock: hasStock,
        warnings,
      };
    });

    const totalCost = bomItems.reduce((sum, item) => sum + (item.bestPrice?.totalPrice ?? 0), 0);
    const itemsFound = bomItems.filter((item) => item.bestPrice !== null).length;
    const itemsMissing = bomItems.length - itemsFound;

    return {
      items: bomItems,
      totalCost,
      currency,
      itemsFound,
      itemsMissing,
      timestamp: Date.now(),
    };
  }

  // -----------------------------------------------------------------------
  // Cache
  // -----------------------------------------------------------------------

  /** Get a cached search result if it exists and hasn't expired. */
  getCachedSearch(query: string): CachedSearch | null {
    const entry = this.cache.get(query);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(query);
      return null;
    }
    return { ...entry };
  }

  /** Set the cache expiry duration in milliseconds. */
  setCacheExpiry(ms: number): void {
    this.cacheExpiryMs = ms;
    this.save();
  }

  /** Clear all cached search results. */
  clearCache(): void {
    this.cache.clear();
  }

  /** Get the number of cached entries. */
  getCacheSize(): number {
    return this.cache.size;
  }

  // -----------------------------------------------------------------------
  // Rate Limiting
  // -----------------------------------------------------------------------

  /** Get the number of remaining requests within the rate limit window for a distributor. */
  getRemainingRequests(distributorId: DistributorId): number {
    const config = this.distributors.find((d) => d.distributorId === distributorId);
    if (!config) {
      return 0;
    }

    const state = this.rateLimits.get(distributorId);
    if (!state) {
      return config.rateLimit;
    }

    const windowStart = Date.now() - 60_000; // 1-minute window
    const recentRequests = state.requests.filter((t) => t > windowStart);
    return Math.max(0, config.rateLimit - recentRequests.length);
  }

  /** Check if a distributor is currently rate-limited. */
  isRateLimited(distributorId: DistributorId): boolean {
    return this.getRemainingRequests(distributorId) <= 0;
  }

  // -----------------------------------------------------------------------
  // Stock Alerts
  // -----------------------------------------------------------------------

  /** Set a stock alert — notify when stock drops below threshold. */
  setStockAlert(mpn: string, threshold: number): void {
    const existing = this.stockAlerts.find((a) => a.mpn === mpn);
    if (existing) {
      existing.threshold = threshold;
    } else {
      this.stockAlerts.push({ mpn, threshold });
    }
    this.save();
    this.notify();
  }

  /** Get all stock alerts. */
  getStockAlerts(): Array<{ mpn: string; threshold: number }> {
    return this.stockAlerts.map((a) => ({ ...a }));
  }

  /** Remove a stock alert. */
  removeStockAlert(mpn: string): void {
    const initialLength = this.stockAlerts.length;
    this.stockAlerts = this.stockAlerts.filter((a) => a.mpn !== mpn);
    if (this.stockAlerts.length !== initialLength) {
      this.save();
      this.notify();
    }
  }

  /** Check all stock alerts against current mock data. Returns triggered alerts. */
  checkAlerts(): Array<{ mpn: string; currentStock: number; threshold: number; triggered: boolean }> {
    return this.stockAlerts.map((alert) => {
      const results = this.searchPart(alert.mpn);
      let totalStock = 0;
      if (results.length > 0) {
        results[0].offers.forEach((offer) => {
          totalStock += offer.stock;
        });
      }

      return {
        mpn: alert.mpn,
        currentStock: totalStock,
        threshold: alert.threshold,
        triggered: totalStock < alert.threshold,
      };
    });
  }

  // -----------------------------------------------------------------------
  // Currency
  // -----------------------------------------------------------------------

  /** Set the active currency. */
  setCurrency(currency: Currency): void {
    if (this.currentCurrency !== currency) {
      this.currentCurrency = currency;
      this.save();
      this.notify();
    }
  }

  /** Get the active currency. */
  getCurrency(): Currency {
    return this.currentCurrency;
  }

  /** Convert an amount between currencies using hardcoded exchange rates. */
  convertCurrency(amount: number, from: Currency, to: Currency): number {
    if (from === to) {
      return amount;
    }
    // Convert to USD first, then to target currency
    const inUsd = amount / EXCHANGE_RATES[from];
    return inUsd * EXCHANGE_RATES[to];
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export configuration as a JSON string. */
  exportConfig(): string {
    const state: PersistedState = {
      enabledDistributors: this.distributors.filter((d) => d.enabled).map((d) => d.distributorId),
      currency: this.currentCurrency,
      cacheExpiryMs: this.cacheExpiryMs,
      stockAlerts: this.stockAlerts.map((a) => ({ ...a })),
    };
    return JSON.stringify(state);
  }

  /** Import configuration from a JSON string. Returns import result. */
  importConfig(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { imported: 0, errors: ['Invalid JSON'] };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { imported: 0, errors: ['Config must be an object'] };
    }

    const data = parsed as Record<string, unknown>;

    // Import enabled distributors
    if (Array.isArray(data.enabledDistributors)) {
      const validIds = this.distributors.map((d) => d.distributorId);
      this.distributors.forEach((d) => {
        d.enabled = false;
      });
      (data.enabledDistributors as unknown[]).forEach((id) => {
        if (typeof id === 'string' && validIds.includes(id as DistributorId)) {
          const dist = this.distributors.find((d) => d.distributorId === id);
          if (dist) {
            dist.enabled = true;
            imported++;
          }
        } else {
          errors.push(`Unknown distributor: ${String(id)}`);
        }
      });
    }

    // Import currency
    if (typeof data.currency === 'string' && data.currency in EXCHANGE_RATES) {
      this.currentCurrency = data.currency as Currency;
      imported++;
    } else if (data.currency !== undefined) {
      errors.push(`Invalid currency: ${String(data.currency)}`);
    }

    // Import cache expiry
    if (typeof data.cacheExpiryMs === 'number' && data.cacheExpiryMs > 0) {
      this.cacheExpiryMs = data.cacheExpiryMs;
      imported++;
    } else if (data.cacheExpiryMs !== undefined) {
      errors.push(`Invalid cacheExpiryMs: ${String(data.cacheExpiryMs)}`);
    }

    // Import stock alerts
    if (Array.isArray(data.stockAlerts)) {
      const validAlerts: StockAlert[] = [];
      (data.stockAlerts as unknown[]).forEach((alert) => {
        if (
          typeof alert === 'object' &&
          alert !== null &&
          typeof (alert as StockAlert).mpn === 'string' &&
          typeof (alert as StockAlert).threshold === 'number'
        ) {
          validAlerts.push({ mpn: (alert as StockAlert).mpn, threshold: (alert as StockAlert).threshold });
          imported++;
        } else {
          errors.push(`Invalid stock alert: ${JSON.stringify(alert)}`);
        }
      });
      this.stockAlerts = validAlerts;
    }

    this.save();
    this.notify();
    return { imported, errors };
  }

  // -----------------------------------------------------------------------
  // Clear / Reset
  // -----------------------------------------------------------------------

  /** Clear all state and reset to defaults. */
  clear(): void {
    this.distributors = DEFAULT_DISTRIBUTORS.map((d) => ({ ...d }));
    this.cache.clear();
    this.cacheExpiryMs = DEFAULT_CACHE_EXPIRY_MS;
    this.rateLimits.clear();
    this.stockAlerts = [];
    this.currentCurrency = 'USD';
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  private getEnabledDistributorIds(filter?: DistributorId[]): DistributorId[] {
    let dists = this.distributors.filter((d) => d.enabled);
    if (filter && filter.length > 0) {
      dists = dists.filter((d) => filter.includes(d.distributorId));
    }
    return dists.map((d) => d.distributorId);
  }

  private getPriceForQuantity(tiers: PricingTier[], quantity: number): number | null {
    // Find the tier that matches the quantity (highest minQuantity that still applies)
    let matchedTier: PricingTier | null = null;
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (quantity >= tier.minQuantity && (tier.maxQuantity === null || quantity <= tier.maxQuantity)) {
        if (!matchedTier || tier.minQuantity > matchedTier.minQuantity) {
          matchedTier = tier;
        }
      }
    }

    if (matchedTier) {
      return matchedTier.unitPrice;
    }
    const firstTier = tiers[0] as PricingTier | undefined;
    return firstTier ? firstTier.unitPrice : null;
  }

  private applySearchOptions(results: PartSearchResult[], options?: SearchOptions): PartSearchResult[] {
    let filtered = [...results];

    if (options?.distributors && options.distributors.length > 0) {
      const allowedDists = options.distributors;
      filtered = filtered.map((part) => ({
        ...part,
        offers: part.offers.filter((o) => allowedDists.includes(o.distributorId)),
      }));
      // Remove parts with no offers after filtering
      filtered = filtered.filter((p) => p.offers.length > 0);
    }

    if (options?.inStockOnly) {
      filtered = filtered.map((part) => ({
        ...part,
        offers: part.offers.filter((o) => o.stockStatus !== 'out-of-stock'),
      }));
      filtered = filtered.filter((p) => p.offers.length > 0);
    }

    // Sort
    if (options?.sortBy) {
      switch (options.sortBy) {
        case 'price':
          filtered.sort((a, b) => {
            const aMin = this.getMinPrice(a.offers);
            const bMin = this.getMinPrice(b.offers);
            return aMin - bMin;
          });
          break;
        case 'stock':
          filtered.sort((a, b) => {
            const aStock = a.offers.reduce((sum, o) => sum + o.stock, 0);
            const bStock = b.offers.reduce((sum, o) => sum + o.stock, 0);
            return bStock - aStock; // Higher stock first
          });
          break;
        case 'leadTime':
          filtered.sort((a, b) => {
            const aLead = this.getMinLeadTime(a.offers);
            const bLead = this.getMinLeadTime(b.offers);
            return aLead - bLead;
          });
          break;
        case 'relevance':
        default:
          // Keep original order (relevance is default)
          break;
      }
    }

    if (options?.maxResults !== undefined && options.maxResults > 0) {
      filtered = filtered.slice(0, options.maxResults);
    }

    return filtered;
  }

  private getMinPrice(offers: DistributorOffer[]): number {
    let min = Infinity;
    offers.forEach((o) => {
      o.pricing.forEach((t) => {
        if (t.unitPrice < min) {
          min = t.unitPrice;
        }
      });
    });
    return min === Infinity ? 0 : min;
  }

  private getMinLeadTime(offers: DistributorOffer[]): number {
    let min = Infinity;
    offers.forEach((o) => {
      if (o.leadTimeDays !== null && o.leadTimeDays < min) {
        min = o.leadTimeDays;
      }
    });
    return min === Infinity ? 9999 : min;
  }

  private recordRequest(distributorId: DistributorId): void {
    let state = this.rateLimits.get(distributorId);
    if (!state) {
      state = { requests: [] };
      this.rateLimits.set(distributorId, state);
    }

    const now = Date.now();
    // Clean up old entries outside the 1-minute window
    state.requests = state.requests.filter((t) => t > now - 60_000);
    state.requests.push(now);
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const state: PersistedState = {
        enabledDistributors: this.distributors.filter((d) => d.enabled).map((d) => d.distributorId),
        currency: this.currentCurrency,
        cacheExpiryMs: this.cacheExpiryMs,
        stockAlerts: this.stockAlerts.map((a) => ({ ...a })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      // Restore enabled distributors
      if (Array.isArray(data.enabledDistributors)) {
        const enabledSet = new Set(data.enabledDistributors as string[]);
        this.distributors.forEach((d) => {
          d.enabled = enabledSet.has(d.distributorId);
        });
      }

      // Restore currency
      if (typeof data.currency === 'string' && data.currency in EXCHANGE_RATES) {
        this.currentCurrency = data.currency as Currency;
      }

      // Restore cache expiry
      if (typeof data.cacheExpiryMs === 'number' && data.cacheExpiryMs > 0) {
        this.cacheExpiryMs = data.cacheExpiryMs;
      }

      // Restore stock alerts
      if (Array.isArray(data.stockAlerts)) {
        this.stockAlerts = (data.stockAlerts as unknown[]).filter(
          (a): a is StockAlert =>
            typeof a === 'object' &&
            a !== null &&
            typeof (a as StockAlert).mpn === 'string' &&
            typeof (a as StockAlert).threshold === 'number',
        );
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the supplier API in React components.
 * Subscribes to the SupplierApiManager singleton and triggers re-renders on state changes.
 */
export function useSupplierApi(): {
  distributors: SupplierConfig[];
  searchPart: (mpn: string, options?: SearchOptions) => PartSearchResult[];
  searchByKeyword: (keyword: string, options?: SearchOptions) => PartSearchResult[];
  getBestPrice: (
    mpn: string,
    quantity: number,
    options?: SearchOptions,
  ) => { distributor: DistributorId; unitPrice: number; totalPrice: number } | null;
  quoteBom: (items: Array<{ mpn: string; quantity: number }>, options?: SearchOptions) => BomQuote;
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  stockAlerts: Array<{ mpn: string; threshold: number }>;
  setStockAlert: (mpn: string, threshold: number) => void;
  removeStockAlert: (mpn: string) => void;
  checkAlerts: () => Array<{ mpn: string; currentStock: number; threshold: number; triggered: boolean }>;
  cache: { size: number; clear: () => void };
  clearCache: () => void;
  exportConfig: () => string;
  importConfig: (json: string) => { imported: number; errors: string[] };
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const api = SupplierApiManager.getInstance();
    const unsubscribe = api.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const searchPart = useCallback((mpn: string, options?: SearchOptions) => {
    return SupplierApiManager.getInstance().searchPart(mpn, options);
  }, []);

  const searchByKeyword = useCallback((keyword: string, options?: SearchOptions) => {
    return SupplierApiManager.getInstance().searchByKeyword(keyword, options);
  }, []);

  const getBestPrice = useCallback(
    (mpn: string, quantity: number, options?: SearchOptions) => {
      return SupplierApiManager.getInstance().getBestPrice(mpn, quantity, options);
    },
    [],
  );

  const quoteBom = useCallback(
    (items: Array<{ mpn: string; quantity: number }>, options?: SearchOptions) => {
      return SupplierApiManager.getInstance().quoteBom(items, options);
    },
    [],
  );

  const setCurrency = useCallback((currency: Currency) => {
    SupplierApiManager.getInstance().setCurrency(currency);
  }, []);

  const setStockAlert = useCallback((mpn: string, threshold: number) => {
    SupplierApiManager.getInstance().setStockAlert(mpn, threshold);
  }, []);

  const removeStockAlert = useCallback((mpn: string) => {
    SupplierApiManager.getInstance().removeStockAlert(mpn);
  }, []);

  const checkAlerts = useCallback(() => {
    return SupplierApiManager.getInstance().checkAlerts();
  }, []);

  const clearCache = useCallback(() => {
    SupplierApiManager.getInstance().clearCache();
  }, []);

  const exportConfig = useCallback(() => {
    return SupplierApiManager.getInstance().exportConfig();
  }, []);

  const importConfig = useCallback((json: string) => {
    return SupplierApiManager.getInstance().importConfig(json);
  }, []);

  const api = typeof window !== 'undefined' ? SupplierApiManager.getInstance() : null;

  return {
    distributors: api?.getDistributors() ?? [],
    searchPart,
    searchByKeyword,
    getBestPrice,
    quoteBom,
    currency: api?.getCurrency() ?? 'USD',
    setCurrency,
    stockAlerts: api?.getStockAlerts() ?? [],
    setStockAlert,
    removeStockAlert,
    checkAlerts,
    cache: {
      size: api?.getCacheSize() ?? 0,
      clear: clearCache,
    },
    clearCache,
    exportConfig,
    importConfig,
  };
}
