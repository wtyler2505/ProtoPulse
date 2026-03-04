/**
 * Pinout Database & Utilities
 *
 * Built-in pinout reference data for common electronic components.
 * Provides lookup, search, and generic fallback generation.
 */

export interface PinInfo {
  number: number;
  name: string;
  functions: string[];
  type: 'power' | 'ground' | 'io' | 'analog' | 'special' | 'nc';
  side?: 'left' | 'right' | 'top' | 'bottom';
}

export interface PinoutEntry {
  name: string;
  aliases: string[];
  family: string;
  package: string;
  pinCount: number;
  pins: PinInfo[];
  description?: string;
  datasheetUrl?: string;
}

// ---------------------------------------------------------------------------
// Built-in pinout database
// ---------------------------------------------------------------------------

const PINOUT_DATABASE: PinoutEntry[] = [
  {
    name: 'ATmega328P',
    aliases: ['Arduino Uno MCU', 'ATMEGA328P-PU', 'ATMEGA328P', 'ATmega328'],
    family: 'AVR Microcontroller',
    package: 'DIP-28',
    pinCount: 28,
    description: '8-bit AVR microcontroller with 32KB flash, used in Arduino Uno',
    datasheetUrl: 'https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7810-Automotive-Microcontrollers-ATmega328P_Datasheet.pdf',
    pins: [
      { number: 1, name: 'PC6/RESET', functions: ['Reset', 'GPIO'], type: 'special', side: 'left' },
      { number: 2, name: 'PD0/RXD', functions: ['GPIO', 'UART RX'], type: 'io', side: 'left' },
      { number: 3, name: 'PD1/TXD', functions: ['GPIO', 'UART TX'], type: 'io', side: 'left' },
      { number: 4, name: 'PD2/INT0', functions: ['GPIO', 'External Interrupt 0'], type: 'io', side: 'left' },
      { number: 5, name: 'PD3/INT1/OC2B', functions: ['GPIO', 'External Interrupt 1', 'PWM'], type: 'io', side: 'left' },
      { number: 6, name: 'PD4/T0/XCK', functions: ['GPIO', 'Timer 0 Clock', 'USART Clock'], type: 'io', side: 'left' },
      { number: 7, name: 'VCC', functions: ['Power Supply'], type: 'power', side: 'left' },
      { number: 8, name: 'GND', functions: ['Ground'], type: 'ground', side: 'left' },
      { number: 9, name: 'PB6/XTAL1', functions: ['Crystal Oscillator 1'], type: 'special', side: 'left' },
      { number: 10, name: 'PB7/XTAL2', functions: ['Crystal Oscillator 2'], type: 'special', side: 'left' },
      { number: 11, name: 'PD5/OC0B/T1', functions: ['GPIO', 'PWM', 'Timer 1 Clock'], type: 'io', side: 'left' },
      { number: 12, name: 'PD6/OC0A/AIN0', functions: ['GPIO', 'PWM', 'Analog Comparator +'], type: 'io', side: 'left' },
      { number: 13, name: 'PD7/AIN1', functions: ['GPIO', 'Analog Comparator -'], type: 'io', side: 'left' },
      { number: 14, name: 'PB0/ICP1/CLKO', functions: ['GPIO', 'Input Capture', 'Clock Output'], type: 'io', side: 'left' },
      { number: 15, name: 'PB1/OC1A', functions: ['GPIO', 'PWM'], type: 'io', side: 'right' },
      { number: 16, name: 'PB2/OC1B/SS', functions: ['GPIO', 'PWM', 'SPI SS'], type: 'io', side: 'right' },
      { number: 17, name: 'PB3/MOSI/OC2A', functions: ['GPIO', 'SPI MOSI', 'PWM'], type: 'io', side: 'right' },
      { number: 18, name: 'PB4/MISO', functions: ['GPIO', 'SPI MISO'], type: 'io', side: 'right' },
      { number: 19, name: 'PB5/SCK', functions: ['GPIO', 'SPI SCK'], type: 'io', side: 'right' },
      { number: 20, name: 'AVCC', functions: ['Analog Power Supply'], type: 'power', side: 'right' },
      { number: 21, name: 'AREF', functions: ['Analog Reference'], type: 'special', side: 'right' },
      { number: 22, name: 'GND', functions: ['Ground'], type: 'ground', side: 'right' },
      { number: 23, name: 'PC0/ADC0', functions: ['GPIO', 'ADC Channel 0'], type: 'analog', side: 'right' },
      { number: 24, name: 'PC1/ADC1', functions: ['GPIO', 'ADC Channel 1'], type: 'analog', side: 'right' },
      { number: 25, name: 'PC2/ADC2', functions: ['GPIO', 'ADC Channel 2'], type: 'analog', side: 'right' },
      { number: 26, name: 'PC3/ADC3', functions: ['GPIO', 'ADC Channel 3'], type: 'analog', side: 'right' },
      { number: 27, name: 'PC4/ADC4/SDA', functions: ['GPIO', 'ADC Channel 4', 'I2C SDA'], type: 'analog', side: 'right' },
      { number: 28, name: 'PC5/ADC5/SCL', functions: ['GPIO', 'ADC Channel 5', 'I2C SCL'], type: 'analog', side: 'right' },
    ],
  },
  {
    name: 'ESP32-WROOM-32',
    aliases: ['ESP32', 'ESP-WROOM-32', 'NodeMCU ESP32', 'ESP32 DevKit'],
    family: 'WiFi/BT Microcontroller',
    package: 'Module-38',
    pinCount: 38,
    description: 'Dual-core WiFi + Bluetooth microcontroller module by Espressif',
    datasheetUrl: 'https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf',
    pins: [
      { number: 1, name: '3V3', functions: ['Power Supply 3.3V'], type: 'power', side: 'left' },
      { number: 2, name: 'EN', functions: ['Enable (Reset)'], type: 'special', side: 'left' },
      { number: 3, name: 'VP/GPIO36', functions: ['GPIO', 'ADC1_CH0', 'Input Only'], type: 'analog', side: 'left' },
      { number: 4, name: 'VN/GPIO39', functions: ['GPIO', 'ADC1_CH3', 'Input Only'], type: 'analog', side: 'left' },
      { number: 5, name: 'GPIO34', functions: ['GPIO', 'ADC1_CH6', 'Input Only'], type: 'analog', side: 'left' },
      { number: 6, name: 'GPIO35', functions: ['GPIO', 'ADC1_CH7', 'Input Only'], type: 'analog', side: 'left' },
      { number: 7, name: 'GPIO32', functions: ['GPIO', 'ADC1_CH4', 'Touch9', 'XTAL32K_P'], type: 'io', side: 'left' },
      { number: 8, name: 'GPIO33', functions: ['GPIO', 'ADC1_CH5', 'Touch8', 'XTAL32K_N'], type: 'io', side: 'left' },
      { number: 9, name: 'GPIO25/DAC1', functions: ['GPIO', 'ADC2_CH8', 'DAC1'], type: 'analog', side: 'left' },
      { number: 10, name: 'GPIO26/DAC2', functions: ['GPIO', 'ADC2_CH9', 'DAC2'], type: 'analog', side: 'left' },
      { number: 11, name: 'GPIO27', functions: ['GPIO', 'ADC2_CH7', 'Touch7'], type: 'io', side: 'left' },
      { number: 12, name: 'GPIO14', functions: ['GPIO', 'ADC2_CH6', 'Touch6', 'HSPI CLK'], type: 'io', side: 'left' },
      { number: 13, name: 'GPIO12', functions: ['GPIO', 'ADC2_CH5', 'Touch5', 'HSPI MISO'], type: 'io', side: 'left' },
      { number: 14, name: 'GND', functions: ['Ground'], type: 'ground', side: 'left' },
      { number: 15, name: 'GPIO13', functions: ['GPIO', 'ADC2_CH4', 'Touch4', 'HSPI MOSI'], type: 'io', side: 'left' },
      { number: 16, name: 'SD2/GPIO9', functions: ['Flash SPI D2'], type: 'special', side: 'left' },
      { number: 17, name: 'SD3/GPIO10', functions: ['Flash SPI D3'], type: 'special', side: 'left' },
      { number: 18, name: 'CMD/GPIO11', functions: ['Flash SPI CMD'], type: 'special', side: 'left' },
      { number: 19, name: 'CLK/GPIO6', functions: ['Flash SPI CLK'], type: 'special', side: 'left' },
      { number: 20, name: 'GND', functions: ['Ground'], type: 'ground', side: 'right' },
      { number: 21, name: 'SD0/GPIO7', functions: ['Flash SPI D0'], type: 'special', side: 'right' },
      { number: 22, name: 'SD1/GPIO8', functions: ['Flash SPI D1'], type: 'special', side: 'right' },
      { number: 23, name: 'GPIO15', functions: ['GPIO', 'ADC2_CH3', 'Touch3', 'HSPI SS'], type: 'io', side: 'right' },
      { number: 24, name: 'GPIO2', functions: ['GPIO', 'ADC2_CH2', 'Touch2', 'Built-in LED'], type: 'io', side: 'right' },
      { number: 25, name: 'GPIO0', functions: ['GPIO', 'ADC2_CH1', 'Touch1', 'Boot'], type: 'special', side: 'right' },
      { number: 26, name: 'GPIO4', functions: ['GPIO', 'ADC2_CH0', 'Touch0'], type: 'io', side: 'right' },
      { number: 27, name: 'GPIO16/RX2', functions: ['GPIO', 'UART2 RX'], type: 'io', side: 'right' },
      { number: 28, name: 'GPIO17/TX2', functions: ['GPIO', 'UART2 TX'], type: 'io', side: 'right' },
      { number: 29, name: 'GPIO5', functions: ['GPIO', 'VSPI SS'], type: 'io', side: 'right' },
      { number: 30, name: 'GPIO18', functions: ['GPIO', 'VSPI CLK'], type: 'io', side: 'right' },
      { number: 31, name: 'GPIO19', functions: ['GPIO', 'VSPI MISO'], type: 'io', side: 'right' },
      { number: 32, name: 'GND', functions: ['Ground'], type: 'ground', side: 'right' },
      { number: 33, name: 'GPIO21', functions: ['GPIO', 'I2C SDA'], type: 'io', side: 'right' },
      { number: 34, name: 'RX0/GPIO3', functions: ['GPIO', 'UART0 RX'], type: 'io', side: 'right' },
      { number: 35, name: 'TX0/GPIO1', functions: ['GPIO', 'UART0 TX'], type: 'io', side: 'right' },
      { number: 36, name: 'GPIO22', functions: ['GPIO', 'I2C SCL'], type: 'io', side: 'right' },
      { number: 37, name: 'GPIO23', functions: ['GPIO', 'VSPI MOSI'], type: 'io', side: 'right' },
      { number: 38, name: 'GND', functions: ['Ground'], type: 'ground', side: 'right' },
    ],
  },
  {
    name: 'NE555',
    aliases: ['LM555', '555 Timer', 'TLC555', 'ICM7555', 'SE555'],
    family: '555 Timer',
    package: 'DIP-8',
    pinCount: 8,
    description: 'General-purpose precision timer IC for monostable, astable, and bistable operation',
    datasheetUrl: 'https://www.ti.com/lit/ds/symlink/ne555.pdf',
    pins: [
      { number: 1, name: 'GND', functions: ['Ground'], type: 'ground', side: 'left' },
      { number: 2, name: 'TRIG', functions: ['Trigger Input'], type: 'io', side: 'left' },
      { number: 3, name: 'OUT', functions: ['Timer Output'], type: 'io', side: 'left' },
      { number: 4, name: 'RESET', functions: ['Active-Low Reset'], type: 'special', side: 'left' },
      { number: 5, name: 'CTRL', functions: ['Control Voltage'], type: 'analog', side: 'right' },
      { number: 6, name: 'THR', functions: ['Threshold Input'], type: 'io', side: 'right' },
      { number: 7, name: 'DIS', functions: ['Discharge'], type: 'io', side: 'right' },
      { number: 8, name: 'VCC', functions: ['Power Supply (4.5V-16V)'], type: 'power', side: 'right' },
    ],
  },
  {
    name: 'LM7805',
    aliases: ['7805', 'L7805', 'MC7805', 'uA7805', '78L05'],
    family: 'Voltage Regulator',
    package: 'TO-220',
    pinCount: 3,
    description: 'Fixed 5V positive linear voltage regulator, 1A output',
    datasheetUrl: 'https://www.ti.com/lit/ds/symlink/lm340.pdf',
    pins: [
      { number: 1, name: 'IN', functions: ['Input Voltage (7V-35V)'], type: 'power', side: 'bottom' },
      { number: 2, name: 'GND', functions: ['Ground'], type: 'ground', side: 'bottom' },
      { number: 3, name: 'OUT', functions: ['Regulated Output (5V)'], type: 'power', side: 'bottom' },
    ],
  },
  {
    name: 'LM317',
    aliases: ['LM317T', 'LM317L', 'LM317HV'],
    family: 'Adjustable Voltage Regulator',
    package: 'TO-220',
    pinCount: 3,
    description: 'Adjustable positive linear voltage regulator (1.25V-37V), 1.5A output',
    datasheetUrl: 'https://www.ti.com/lit/ds/symlink/lm317.pdf',
    pins: [
      { number: 1, name: 'ADJ', functions: ['Adjustment Pin'], type: 'analog', side: 'bottom' },
      { number: 2, name: 'OUT', functions: ['Regulated Output'], type: 'power', side: 'bottom' },
      { number: 3, name: 'IN', functions: ['Input Voltage'], type: 'power', side: 'bottom' },
    ],
  },
  {
    name: 'LM358',
    aliases: ['NE5532', 'LM358N', 'LM358P', 'TL072', 'Dual Op-Amp'],
    family: 'Operational Amplifier',
    package: 'DIP-8',
    pinCount: 8,
    description: 'Dual low-power operational amplifier',
    datasheetUrl: 'https://www.ti.com/lit/ds/symlink/lm358.pdf',
    pins: [
      { number: 1, name: 'OUT1', functions: ['Op-Amp 1 Output'], type: 'io', side: 'left' },
      { number: 2, name: 'IN1-', functions: ['Op-Amp 1 Inverting Input'], type: 'io', side: 'left' },
      { number: 3, name: 'IN1+', functions: ['Op-Amp 1 Non-Inverting Input'], type: 'io', side: 'left' },
      { number: 4, name: 'GND/V-', functions: ['Ground / Negative Supply'], type: 'ground', side: 'left' },
      { number: 5, name: 'IN2+', functions: ['Op-Amp 2 Non-Inverting Input'], type: 'io', side: 'right' },
      { number: 6, name: 'IN2-', functions: ['Op-Amp 2 Inverting Input'], type: 'io', side: 'right' },
      { number: 7, name: 'OUT2', functions: ['Op-Amp 2 Output'], type: 'io', side: 'right' },
      { number: 8, name: 'VCC/V+', functions: ['Positive Supply (3V-32V)'], type: 'power', side: 'right' },
    ],
  },
  {
    name: '2N2222',
    aliases: ['2N2222A', 'PN2222', 'P2N2222A', '2N3904', 'BC547', 'NPN Transistor'],
    family: 'NPN Bipolar Transistor',
    package: 'TO-92',
    pinCount: 3,
    description: 'General-purpose NPN switching transistor (40V, 800mA)',
    datasheetUrl: 'https://www.onsemi.com/pdf/datasheet/p2n2222a-d.pdf',
    pins: [
      { number: 1, name: 'E', functions: ['Emitter'], type: 'io', side: 'bottom' },
      { number: 2, name: 'B', functions: ['Base'], type: 'io', side: 'bottom' },
      { number: 3, name: 'C', functions: ['Collector'], type: 'io', side: 'bottom' },
    ],
  },
  {
    name: 'IRF540N',
    aliases: ['IRF540', 'IRFZ44N', 'IRF3205', 'N-Channel MOSFET'],
    family: 'N-Channel MOSFET',
    package: 'TO-220',
    pinCount: 3,
    description: 'N-channel power MOSFET (100V, 33A, 44mOhm)',
    datasheetUrl: 'https://www.infineon.com/dgdl/irf540n.pdf',
    pins: [
      { number: 1, name: 'G', functions: ['Gate'], type: 'io', side: 'bottom' },
      { number: 2, name: 'D', functions: ['Drain'], type: 'io', side: 'bottom' },
      { number: 3, name: 'S', functions: ['Source'], type: 'io', side: 'bottom' },
    ],
  },
  {
    name: 'Arduino Uno',
    aliases: ['Arduino Uno R3', 'UNO', 'Arduino'],
    family: 'Development Board',
    package: 'Board',
    pinCount: 32,
    description: 'Arduino Uno R3 development board with ATmega328P',
    datasheetUrl: 'https://docs.arduino.cc/hardware/uno-rev3',
    pins: [
      { number: 1, name: 'D0/RX', functions: ['Digital IO', 'UART RX'], type: 'io', side: 'right' },
      { number: 2, name: 'D1/TX', functions: ['Digital IO', 'UART TX'], type: 'io', side: 'right' },
      { number: 3, name: 'D2', functions: ['Digital IO', 'INT0'], type: 'io', side: 'right' },
      { number: 4, name: 'D3~', functions: ['Digital IO', 'PWM', 'INT1'], type: 'io', side: 'right' },
      { number: 5, name: 'D4', functions: ['Digital IO'], type: 'io', side: 'right' },
      { number: 6, name: 'D5~', functions: ['Digital IO', 'PWM'], type: 'io', side: 'right' },
      { number: 7, name: 'D6~', functions: ['Digital IO', 'PWM'], type: 'io', side: 'right' },
      { number: 8, name: 'D7', functions: ['Digital IO'], type: 'io', side: 'right' },
      { number: 9, name: 'D8', functions: ['Digital IO'], type: 'io', side: 'right' },
      { number: 10, name: 'D9~', functions: ['Digital IO', 'PWM'], type: 'io', side: 'right' },
      { number: 11, name: 'D10~/SS', functions: ['Digital IO', 'PWM', 'SPI SS'], type: 'io', side: 'right' },
      { number: 12, name: 'D11~/MOSI', functions: ['Digital IO', 'PWM', 'SPI MOSI'], type: 'io', side: 'right' },
      { number: 13, name: 'D12/MISO', functions: ['Digital IO', 'SPI MISO'], type: 'io', side: 'right' },
      { number: 14, name: 'D13/SCK', functions: ['Digital IO', 'SPI SCK', 'LED'], type: 'io', side: 'right' },
      { number: 15, name: 'GND', functions: ['Ground'], type: 'ground', side: 'right' },
      { number: 16, name: 'AREF', functions: ['Analog Reference'], type: 'special', side: 'right' },
      { number: 17, name: 'A4/SDA', functions: ['Analog Input', 'I2C SDA'], type: 'analog', side: 'left' },
      { number: 18, name: 'A5/SCL', functions: ['Analog Input', 'I2C SCL'], type: 'analog', side: 'left' },
      { number: 19, name: 'A0', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 20, name: 'A1', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 21, name: 'A2', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 22, name: 'A3', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 23, name: 'A4', functions: ['Analog Input', 'I2C SDA'], type: 'analog', side: 'left' },
      { number: 24, name: 'A5', functions: ['Analog Input', 'I2C SCL'], type: 'analog', side: 'left' },
      { number: 25, name: 'VIN', functions: ['External Voltage Input (7-12V)'], type: 'power', side: 'left' },
      { number: 26, name: 'GND', functions: ['Ground'], type: 'ground', side: 'left' },
      { number: 27, name: 'GND', functions: ['Ground'], type: 'ground', side: 'left' },
      { number: 28, name: '5V', functions: ['Regulated 5V Output'], type: 'power', side: 'left' },
      { number: 29, name: '3.3V', functions: ['Regulated 3.3V Output'], type: 'power', side: 'left' },
      { number: 30, name: 'RESET', functions: ['Reset'], type: 'special', side: 'left' },
      { number: 31, name: 'IOREF', functions: ['IO Reference Voltage'], type: 'special', side: 'left' },
      { number: 32, name: 'NC', functions: ['Not Connected'], type: 'nc', side: 'left' },
    ],
  },
  {
    name: 'Arduino Mega 2560',
    aliases: ['Arduino Mega', 'Mega 2560', 'Mega2560', 'ATmega2560 Board'],
    family: 'Development Board',
    package: 'Board',
    pinCount: 70,
    description: 'Arduino Mega 2560 R3 development board with ATmega2560 (54 digital IO, 16 analog inputs)',
    datasheetUrl: 'https://docs.arduino.cc/hardware/mega-2560',
    pins: [
      { number: 1, name: 'D0/RX0', functions: ['Digital IO', 'UART0 RX'], type: 'io', side: 'right' },
      { number: 2, name: 'D1/TX0', functions: ['Digital IO', 'UART0 TX'], type: 'io', side: 'right' },
      { number: 3, name: 'D2/INT4', functions: ['Digital IO', 'PWM', 'Interrupt'], type: 'io', side: 'right' },
      { number: 4, name: 'D3~/INT5', functions: ['Digital IO', 'PWM', 'Interrupt'], type: 'io', side: 'right' },
      { number: 5, name: 'D4/PWM', functions: ['Digital IO', 'PWM'], type: 'io', side: 'right' },
      { number: 6, name: 'D5~/PWM', functions: ['Digital IO', 'PWM'], type: 'io', side: 'right' },
      { number: 7, name: 'D6~/PWM', functions: ['Digital IO', 'PWM'], type: 'io', side: 'right' },
      { number: 8, name: 'D7~/PWM', functions: ['Digital IO', 'PWM'], type: 'io', side: 'right' },
      { number: 9, name: 'D8~/PWM', functions: ['Digital IO', 'PWM'], type: 'io', side: 'right' },
      { number: 10, name: 'D9~/PWM', functions: ['Digital IO', 'PWM'], type: 'io', side: 'right' },
      { number: 11, name: 'D10~/PWM/SS', functions: ['Digital IO', 'PWM', 'SPI SS'], type: 'io', side: 'right' },
      { number: 12, name: 'D11~/PWM/MOSI', functions: ['Digital IO', 'PWM', 'SPI MOSI'], type: 'io', side: 'right' },
      { number: 13, name: 'D12/PWM/MISO', functions: ['Digital IO', 'PWM', 'SPI MISO'], type: 'io', side: 'right' },
      { number: 14, name: 'D13/PWM/SCK', functions: ['Digital IO', 'PWM', 'SPI SCK', 'LED'], type: 'io', side: 'right' },
      { number: 15, name: 'D14/TX3', functions: ['Digital IO', 'UART3 TX'], type: 'io', side: 'right' },
      { number: 16, name: 'D15/RX3', functions: ['Digital IO', 'UART3 RX'], type: 'io', side: 'right' },
      { number: 17, name: 'D16/TX2', functions: ['Digital IO', 'UART2 TX'], type: 'io', side: 'right' },
      { number: 18, name: 'D17/RX2', functions: ['Digital IO', 'UART2 RX'], type: 'io', side: 'right' },
      { number: 19, name: 'D18/TX1', functions: ['Digital IO', 'UART1 TX', 'Interrupt'], type: 'io', side: 'right' },
      { number: 20, name: 'D19/RX1', functions: ['Digital IO', 'UART1 RX', 'Interrupt'], type: 'io', side: 'right' },
      { number: 21, name: 'D20/SDA', functions: ['Digital IO', 'I2C SDA', 'Interrupt'], type: 'io', side: 'right' },
      { number: 22, name: 'D21/SCL', functions: ['Digital IO', 'I2C SCL', 'Interrupt'], type: 'io', side: 'right' },
      { number: 23, name: 'D22-D53', functions: ['Digital IO'], type: 'io', side: 'right' },
      { number: 24, name: 'A0', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 25, name: 'A1', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 26, name: 'A2', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 27, name: 'A3', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 28, name: 'A4', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 29, name: 'A5', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 30, name: 'A6', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 31, name: 'A7', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 32, name: 'A8', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 33, name: 'A9', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 34, name: 'A10', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 35, name: 'A11', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 36, name: 'A12', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 37, name: 'A13', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 38, name: 'A14', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 39, name: 'A15', functions: ['Analog Input'], type: 'analog', side: 'left' },
      { number: 40, name: 'VIN', functions: ['External Voltage Input (7-12V)'], type: 'power', side: 'left' },
      { number: 41, name: 'GND', functions: ['Ground'], type: 'ground', side: 'left' },
      { number: 42, name: 'GND', functions: ['Ground'], type: 'ground', side: 'left' },
      { number: 43, name: '5V', functions: ['Regulated 5V Output'], type: 'power', side: 'left' },
      { number: 44, name: '3.3V', functions: ['Regulated 3.3V Output'], type: 'power', side: 'left' },
      { number: 45, name: 'RESET', functions: ['Reset'], type: 'special', side: 'left' },
      { number: 46, name: 'IOREF', functions: ['IO Reference Voltage'], type: 'special', side: 'left' },
      { number: 47, name: '5V', functions: ['Regulated 5V Output'], type: 'power', side: 'left' },
      ...Array.from({ length: 23 }, (_, i) => ({
        number: 48 + i,
        name: `D${24 + i}`,
        functions: ['Digital IO'] as string[],
        type: 'io' as const,
        side: 'right' as const,
      })),
    ],
  },
  {
    name: 'ATtiny85',
    aliases: ['ATtiny85V', 'Digispark', 'ATtiny85-20PU'],
    family: 'AVR Microcontroller',
    package: 'DIP-8',
    pinCount: 8,
    description: '8-bit AVR microcontroller with 8KB flash, 5 IO pins',
    datasheetUrl: 'https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-2586-AVR-8-bit-Microcontroller-ATtiny25-ATtiny45-ATtiny85_Datasheet.pdf',
    pins: [
      { number: 1, name: 'PB5/RESET/ADC0', functions: ['GPIO', 'Reset', 'ADC0'], type: 'special', side: 'left' },
      { number: 2, name: 'PB3/ADC3/XTAL1', functions: ['GPIO', 'ADC3', 'Crystal 1'], type: 'io', side: 'left' },
      { number: 3, name: 'PB4/ADC2/XTAL2', functions: ['GPIO', 'ADC2', 'Crystal 2'], type: 'io', side: 'left' },
      { number: 4, name: 'GND', functions: ['Ground'], type: 'ground', side: 'left' },
      { number: 5, name: 'PB0/MOSI/SDA', functions: ['GPIO', 'SPI MOSI', 'I2C SDA', 'PWM'], type: 'io', side: 'right' },
      { number: 6, name: 'PB1/MISO/OC1A', functions: ['GPIO', 'SPI MISO', 'PWM'], type: 'io', side: 'right' },
      { number: 7, name: 'PB2/SCK/SCL/ADC1', functions: ['GPIO', 'SPI SCK', 'I2C SCL', 'ADC1'], type: 'io', side: 'right' },
      { number: 8, name: 'VCC', functions: ['Power Supply (2.7V-5.5V)'], type: 'power', side: 'right' },
    ],
  },
  {
    name: 'L293D',
    aliases: ['L293', 'SN754410', 'Motor Driver', 'H-Bridge'],
    family: 'Motor Driver',
    package: 'DIP-16',
    pinCount: 16,
    description: 'Quadruple half-H driver for DC and stepper motors (600mA per channel)',
    datasheetUrl: 'https://www.ti.com/lit/ds/symlink/l293d.pdf',
    pins: [
      { number: 1, name: 'EN1,2', functions: ['Enable Channels 1 & 2'], type: 'io', side: 'left' },
      { number: 2, name: '1A', functions: ['Input 1'], type: 'io', side: 'left' },
      { number: 3, name: '1Y', functions: ['Output 1'], type: 'io', side: 'left' },
      { number: 4, name: 'GND', functions: ['Ground / Heat Sink'], type: 'ground', side: 'left' },
      { number: 5, name: 'GND', functions: ['Ground / Heat Sink'], type: 'ground', side: 'left' },
      { number: 6, name: '2Y', functions: ['Output 2'], type: 'io', side: 'left' },
      { number: 7, name: '2A', functions: ['Input 2'], type: 'io', side: 'left' },
      { number: 8, name: 'VCC2', functions: ['Motor Power Supply (up to 36V)'], type: 'power', side: 'left' },
      { number: 9, name: 'EN3,4', functions: ['Enable Channels 3 & 4'], type: 'io', side: 'right' },
      { number: 10, name: '3A', functions: ['Input 3'], type: 'io', side: 'right' },
      { number: 11, name: '3Y', functions: ['Output 3'], type: 'io', side: 'right' },
      { number: 12, name: 'GND', functions: ['Ground / Heat Sink'], type: 'ground', side: 'right' },
      { number: 13, name: 'GND', functions: ['Ground / Heat Sink'], type: 'ground', side: 'right' },
      { number: 14, name: '4Y', functions: ['Output 4'], type: 'io', side: 'right' },
      { number: 15, name: '4A', functions: ['Input 4'], type: 'io', side: 'right' },
      { number: 16, name: 'VCC1', functions: ['Logic Power Supply (5V)'], type: 'power', side: 'right' },
    ],
  },
  {
    name: '74HC595',
    aliases: ['SN74HC595', 'Shift Register', '595'],
    family: 'Shift Register',
    package: 'DIP-16',
    pinCount: 16,
    description: '8-bit serial-in, parallel-out shift register with output latches',
    datasheetUrl: 'https://www.ti.com/lit/ds/symlink/sn74hc595.pdf',
    pins: [
      { number: 1, name: 'QB', functions: ['Parallel Output B'], type: 'io', side: 'left' },
      { number: 2, name: 'QC', functions: ['Parallel Output C'], type: 'io', side: 'left' },
      { number: 3, name: 'QD', functions: ['Parallel Output D'], type: 'io', side: 'left' },
      { number: 4, name: 'QE', functions: ['Parallel Output E'], type: 'io', side: 'left' },
      { number: 5, name: 'QF', functions: ['Parallel Output F'], type: 'io', side: 'left' },
      { number: 6, name: 'QG', functions: ['Parallel Output G'], type: 'io', side: 'left' },
      { number: 7, name: 'QH', functions: ['Parallel Output H'], type: 'io', side: 'left' },
      { number: 8, name: 'GND', functions: ['Ground'], type: 'ground', side: 'left' },
      { number: 9, name: 'QH\'', functions: ['Serial Output (Cascade)'], type: 'io', side: 'right' },
      { number: 10, name: 'SRCLR', functions: ['Shift Register Clear (Active Low)'], type: 'special', side: 'right' },
      { number: 11, name: 'SRCLK', functions: ['Shift Register Clock'], type: 'io', side: 'right' },
      { number: 12, name: 'RCLK', functions: ['Storage Register Clock (Latch)'], type: 'io', side: 'right' },
      { number: 13, name: 'OE', functions: ['Output Enable (Active Low)'], type: 'special', side: 'right' },
      { number: 14, name: 'SER', functions: ['Serial Data Input'], type: 'io', side: 'right' },
      { number: 15, name: 'QA', functions: ['Parallel Output A'], type: 'io', side: 'right' },
      { number: 16, name: 'VCC', functions: ['Power Supply (2V-6V)'], type: 'power', side: 'right' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Normalization helper for matching
// ---------------------------------------------------------------------------

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a pinout entry by exact or fuzzy name/alias match.
 * Returns the best match or null if nothing is close enough.
 */
export function lookupPinout(query: string): PinoutEntry | null {
  const q = normalize(query);
  if (q.length === 0) {
    return null;
  }

  // Exact match on name or alias (normalized)
  for (const entry of PINOUT_DATABASE) {
    if (normalize(entry.name) === q) {
      return entry;
    }
    for (const alias of entry.aliases) {
      if (normalize(alias) === q) {
        return entry;
      }
    }
  }

  // Substring / contains match — name or alias contains the query, or query contains name
  for (const entry of PINOUT_DATABASE) {
    const normName = normalize(entry.name);
    if (normName.includes(q) || q.includes(normName)) {
      return entry;
    }
    for (const alias of entry.aliases) {
      const normAlias = normalize(alias);
      if (normAlias.includes(q) || q.includes(normAlias)) {
        return entry;
      }
    }
  }

  // Family match
  for (const entry of PINOUT_DATABASE) {
    if (normalize(entry.family).includes(q)) {
      return entry;
    }
  }

  return null;
}

/**
 * Generate a generic pinout for components not in the database.
 * Creates numbered pins with sensible defaults based on pin count and package.
 */
export function getGenericPinout(pinCount: number, packageType?: string): PinoutEntry {
  const pkg = packageType ?? (pinCount <= 3 ? 'TO-92' : pinCount <= 8 ? 'DIP-8' : `DIP-${pinCount}`);
  const isDip = pkg.toUpperCase().startsWith('DIP') || pinCount > 3;
  const isSmallPackage = pinCount <= 3;

  const pins: PinInfo[] = Array.from({ length: pinCount }, (_, i) => {
    const pinNumber = i + 1;
    let side: PinInfo['side'];
    if (isSmallPackage) {
      side = 'bottom';
    } else if (isDip) {
      side = pinNumber <= Math.ceil(pinCount / 2) ? 'left' : 'right';
    } else {
      side = pinNumber <= Math.ceil(pinCount / 2) ? 'left' : 'right';
    }

    return {
      number: pinNumber,
      name: `Pin ${pinNumber}`,
      functions: ['Unknown'],
      type: 'io' as const,
      side,
    };
  });

  return {
    name: 'Unknown Component',
    aliases: [],
    family: 'Generic',
    package: pkg,
    pinCount,
    pins,
    description: `Generic ${pinCount}-pin component (${pkg})`,
  };
}

/**
 * Return all pinout entries in the database.
 */
export function getAllPinouts(): PinoutEntry[] {
  return [...PINOUT_DATABASE];
}

/**
 * Search pinouts with partial matching on name, aliases, family, and description.
 * Returns all matches sorted by relevance (exact > starts-with > contains).
 */
export function searchPinouts(query: string): PinoutEntry[] {
  const q = normalize(query);
  if (q.length === 0) {
    return [];
  }

  const scored: Array<{ entry: PinoutEntry; score: number }> = [];

  for (const entry of PINOUT_DATABASE) {
    let bestScore = 0;
    const normName = normalize(entry.name);

    // Exact match on name = highest score
    if (normName === q) {
      bestScore = 100;
    } else if (normName.startsWith(q)) {
      bestScore = Math.max(bestScore, 80);
    } else if (normName.includes(q)) {
      bestScore = Math.max(bestScore, 60);
    }

    // Check aliases
    for (const alias of entry.aliases) {
      const normAlias = normalize(alias);
      if (normAlias === q) {
        bestScore = Math.max(bestScore, 95);
      } else if (normAlias.startsWith(q)) {
        bestScore = Math.max(bestScore, 75);
      } else if (normAlias.includes(q)) {
        bestScore = Math.max(bestScore, 55);
      }
    }

    // Check family
    const normFamily = normalize(entry.family);
    if (normFamily.includes(q)) {
      bestScore = Math.max(bestScore, 40);
    }

    // Check description
    if (entry.description && normalize(entry.description).includes(q)) {
      bestScore = Math.max(bestScore, 30);
    }

    if (bestScore > 0) {
      scored.push({ entry, score: bestScore });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.entry);
}
