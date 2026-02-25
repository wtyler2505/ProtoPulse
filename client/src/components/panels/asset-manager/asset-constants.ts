import {
  Cpu, Battery, Radio, Activity, Zap, Component,
} from 'lucide-react';

export interface Asset {
  id: string;
  type: string;
  name: string;
  desc: string;
  specs: { label: string; value: string }[];
  package?: string;
  voltage?: string;
  datasheet?: string;
  custom?: boolean;
}

export interface Category {
  id: string;
  label: string;
  icon: typeof Component;
}

export const categories: Category[] = [
  { id: 'all', label: 'All', icon: Component },
  { id: 'mcu', label: 'Microcontrollers', icon: Cpu },
  { id: 'power', label: 'Power', icon: Battery },
  { id: 'comm', label: 'Communication', icon: Radio },
  { id: 'sensor', label: 'Sensors', icon: Activity },
  { id: 'connector', label: 'Connectors', icon: Zap },
];

export const builtInAssets: Asset[] = [
  { id: '1', type: 'mcu', name: 'ESP32-S3-WROOM-1', desc: 'Dual-core, Wi-Fi/BLE, AI instructions', specs: [{ label: 'Core', value: 'Xtensa LX7 Dual' }, { label: 'Flash', value: '8MB' }, { label: 'RAM', value: '512KB' }, { label: 'GPIO', value: '36' }], package: 'Module', voltage: '3.0-3.6V', datasheet: 'https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf' },
  { id: '2', type: 'mcu', name: 'STM32L432KC', desc: 'Ultra-low-power, ARM Cortex-M4', specs: [{ label: 'Core', value: 'Cortex-M4 80MHz' }, { label: 'Flash', value: '256KB' }, { label: 'RAM', value: '64KB' }, { label: 'GPIO', value: '26' }], package: 'UFQFPN32', voltage: '1.71-3.6V', datasheet: 'https://www.st.com/resource/en/datasheet/stm32l432kc.pdf' },
  { id: '3', type: 'power', name: 'TP4056', desc: '1A Li-Ion Battery Charger', specs: [{ label: 'Current', value: '1A max' }, { label: 'Input', value: '4.5-5.5V' }, { label: 'Accuracy', value: '±1.5%' }], package: 'SOP-8', voltage: '4.5-5.5V', datasheet: 'https://dlnmh9ip6v2uc.cloudfront.net/datasheets/Prototyping/TP4056.pdf' },
  { id: '4', type: 'power', name: 'LDO 3.3V', desc: 'Low-dropout regulator, 500mA', specs: [{ label: 'Output', value: '3.3V' }, { label: 'Current', value: '500mA' }, { label: 'Dropout', value: '250mV' }], package: 'SOT-223', voltage: '3.5-6V' },
  { id: '5', type: 'comm', name: 'SX1262 LoRa', desc: 'Long-range low-power transceiver', specs: [{ label: 'Freq', value: '150-960MHz' }, { label: 'Power', value: '+22dBm' }, { label: 'Range', value: '15km+' }, { label: 'Interface', value: 'SPI' }], package: 'QFN24', voltage: '1.8-3.7V', datasheet: 'https://semtech.my.salesforce.com/sfc/p/E0000000JelG/a/2R000000HT76/WIeRBkuMEaVPUvKqyfq_cjYvYqfMjiAFQlFSp3To3Oc' },
  { id: '6', type: 'comm', name: 'SIM7000G', desc: 'NB-IoT / LTE-M Module', specs: [{ label: 'Bands', value: 'Multi-band' }, { label: 'GNSS', value: 'GPS/GLONASS' }, { label: 'Interface', value: 'UART' }], package: 'LCC+LGA', voltage: '3.0-4.3V' },
  { id: '7', type: 'sensor', name: 'SHT40', desc: 'High-accuracy humidity/temp', specs: [{ label: 'Accuracy', value: '±1.8% RH' }, { label: 'Range', value: '-40 to 125°C' }, { label: 'Interface', value: 'I2C' }], package: 'DFN 1.5x1.5', voltage: '1.08-3.6V' },
  { id: '8', type: 'sensor', name: 'L86 GNSS', desc: 'GPS/GLONASS patch antenna module', specs: [{ label: 'Systems', value: 'GPS+GLONASS' }, { label: 'Accuracy', value: '2.5m CEP' }, { label: 'Interface', value: 'UART' }], package: 'Module 18.4x18.4', voltage: '3.0-4.3V' },
  { id: '9', type: 'connector', name: 'USB-C Receptacle', desc: 'USB Type-C power/data connector', specs: [{ label: 'Current', value: '5A max' }, { label: 'Pins', value: '16/24' }], package: 'SMD Mid-mount' },
  { id: '10', type: 'connector', name: 'JST-PH 2mm', desc: '2-pin battery connector', specs: [{ label: 'Pitch', value: '2mm' }, { label: 'Current', value: '2A' }], package: 'THT' },
  { id: '11', type: 'sensor', name: 'BME280', desc: 'Pressure/humidity/temp sensor', specs: [{ label: 'Pressure', value: '300-1100hPa' }, { label: 'Accuracy', value: '±1hPa' }, { label: 'Interface', value: 'I2C/SPI' }], package: 'LGA 2.5x2.5', voltage: '1.71-3.6V' },
  { id: '12', type: 'power', name: 'TPS63020', desc: 'Buck-boost converter', specs: [{ label: 'Input', value: '1.8-5.5V' }, { label: 'Output', value: '1.2-5.5V' }, { label: 'Current', value: '3A' }], package: 'QFN14', voltage: '1.8-5.5V' },
];
