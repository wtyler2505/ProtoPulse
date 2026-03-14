---
# LLM Optimization Metadata
metadata:
  document_id: 'hardware-specifications'
  document_type: 'technical-reference'
  target_audience: ['intermediate', 'advanced', 'developers', 'hardware-engineers', 'technicians']
  complexity_level: 'expert'
  estimated_read_time: '25 minutes'
  last_updated: '2025-11-05'
  version: '1.0.0'

# Content Classification
tags:
  - 'hardware-specifications'
  - 'arduino-mega'
  - 'nodemcu-esp8266'
  - 'zsx11h-motor-controller'
  - 'pinouts'
  - 'power-systems'
  - 'communication-protocols'
  - 'electrical-specifications'

# Document Relationships
depends_on: []
required_by:
  - 'getting-started/beginners-guide-wiring.md'
  - 'getting-started/beginners-guide-pinouts.md'
  - 'hardware/wiring/complete-wiring-guide.md'
  - 'software/motor-control-system-architecture.md'
  - 'software/websocket-communication-architecture.md'
related_docs:
  - 'README.md'
  - 'troubleshooting.md'
  - 'security-best-practices.md'
  - 'deployment-guide.md'

# Content Summary
summary: |
  Comprehensive hardware specifications for the OmniTrek Nexus rover system. Includes detailed technical
  specifications for Arduino Mega 2560 microcontroller, NodeMCU ESP8266 WiFi module, and RioRand ZS-X11H
  motor controllers. Covers pinouts, power requirements, communication protocols, programming interfaces,
  and complete electrical specifications for rover hardware integration.

# Key Entities
key_entities:
  - 'Arduino Mega 2560: Main microcontroller for motor control and sensor processing'
  - 'NodeMCU ESP8266: WiFi communication bridge between rover and web interface'
  - 'RioRand ZS-X11H: 350W brushless motor controllers with Hall effect sensors'
  - 'Power Systems: Multi-voltage architecture (36V motors, 25.2V logic, 9V Arduino)'
  - 'Communication Protocols: Serial UART, I2C, SPI, WiFi, WebSocket'
  - 'Pinouts: Complete GPIO mapping and connection specifications'
  - 'Hall Effect Sensors: Motor position and speed feedback system'
  - 'PWM Control: Pulse Width Modulation for motor speed regulation'
  - 'Emergency Stop: Hardware safety circuit for immediate shutdown'

# Hardware Components
hardware_categories:
  microcontrollers:
    primary: 'Arduino Mega 2560 - Motor control and sensor processing'
    secondary: 'NodeMCU ESP8266 - WiFi communication and data routing'
    communication: 'Serial UART (115200 baud), I2C, SPI protocols'
  motor_controllers:
    model: 'RioRand ZS-X11H Brushless Controller'
    specifications: '350W, 6-60V, Hall sensor support'
    control_method: 'PWM signal with direction control'
  power_systems:
    motor_power: '36V DC battery pack'
    logic_power: '25.2V DC regulation'
    arduino_power: '9V DC supply'
    safety_features: 'Emergency stop, over-current protection'

# Quick Reference
quick_reference:
  critical_specifications:
    arduino_mega:
      microcontroller: 'ATmega2560'
      clock_speed: '16MHz'
      flash_memory: '256KB'
      sram: '8KB'
      eeprom: '4KB'
      digital_pins: '54 (15 PWM)'
      analog_pins: '16'
      hardware_serial: '4 ports'
    nodemcu_esp8266:
      microcontroller: 'ESP8266EX'
      clock_speed: '80-160MHz'
      flash_memory: '4MB'
      sram: '80KB'
      wifi_protocols: '802.11 b/g/n'
      gpio_pins: '16 (11 usable)'
      analog_input: '1 (0-1.0V)'
    zsx11h_controller:
      power_rating: '350W continuous'
      voltage_range: '6-60V DC'
      current_rating: '7-20A'
      control_voltage: '3.3-12V logic'
      pwm_frequency: '20kHz'
      hall_sensors: 'Built-in support'
  communication_protocols:
    arduino_to_esp8266: 'Serial UART at 115200 baud'
    esp8266_to_web: 'WebSocket over WiFi'
    motor_control: 'PWM signals (0-5V)'
    sensor_data: 'Analog and digital inputs'
  power_requirements:
    total_consumption: '~500W under load'
    battery_voltage: '36V (30-42V range)'
    minimum_voltage: '21V (25.2V system), 30V (36V system)'
    charging_voltage: '42V for 36V system'
    safety_cutoff: 'Low voltage protection'
  critical_connections:
    - 'Arduino D2-D13: Motor controller PWM outputs'
    - 'Arduino Serial1: ESP8266 communication (TX1/RX1)'
    - 'Arduino A0-A5: Analog sensor inputs'
    - 'ESP8266 D1-D8: GPIO and status indicators'
    - 'Power rails: 36V motor, 25.2V logic, 9V Arduino'
    - 'Emergency stop: Hardware interrupt to Arduino'
---

# OmniTrek Nexus - Complete Hardware Specifications

**Version:** 1.0.0 **Last Updated:** 2025-11-05 **Document Type:** Comprehensive Technical Reference
**Motor Controller:** RioRand ZS-X11H (350W 6-60V Brushless with Hall)

---

## Table of Contents

1. [Overview](#overview)
2. [Arduino Mega 2560](#arduino-mega-2560)
   - [Complete Specifications](#arduino-complete-specifications)
   - [ATmega2560 Microcontroller Details](#atmega2560-microcontroller)
   - [Pinout and Pin Functions](#arduino-pinout)
   - [Serial Communication](#arduino-serial)
   - [Power Specifications](#arduino-power)
   - [Programming Interface](#arduino-programming)
3. [NodeMCU ESP8266](#nodemcu-esp8266)
   - [Complete Specifications](#nodemcu-complete-specifications)
   - [ESP8266EX Chip Details](#esp8266ex-chip)
   - [Pinout and GPIO Functions](#nodemcu-pinout)
   - [WiFi Specifications](#nodemcu-wifi)
   - [Power Specifications](#nodemcu-power)
   - [Programming Interface](#nodemcu-programming)
4. [RioRand ZS-X11H Motor Controller](#riorand-zs-x11h-motor-controller)
   - [Overview](#overview)
   - [Complete Specifications](#complete-specifications)
   - [Detailed Pinout and Connections](#detailed-pinout-and-connections)
   - [Control Modes and Logic](#control-modes-and-logic)
   - [Hardware Setup](#hardware-setup-and-jumper-configuration)
   - [Operating Notes and Warnings](#important-operating-notes-and-warnings)
   - [Complete Arduino Examples](#complete-arduino-example-for-zs-x11h)
   - [Wiring Guide](#zs-x11h-wiring-guide)
   - [Troubleshooting](#troubleshooting-guide)
   - [Performance Optimization](#performance-optimization-tips)
5. [Brushless Hub Motors](#brushless-hub-motors)
   - [Motor Specifications](#motor-specifications)
   - [Wire Configuration](#motor-wiring)
   - [Hall Sensor Details](#hall-sensors)
   - [ESC PWM Protocol](#esc-pwm)
6. [System Integration](#system-integration)
   - [Power Distribution](#power-distribution)
   - [Communication Architecture](#communication-architecture)
   - [Wiring Diagrams](#wiring-diagrams)
7. [Technical Resources](#technical-resources)
8. [Appendices](#appendices)

---

## Overview

The OmniTrek Nexus autonomous rover uses a distributed control architecture with multiple
microcontrollers working together to control motors, sensors, and communicate with the web-based
control interface.

### Hardware Stack

- **Main Controller:** Arduino Mega 2560 (ATmega2560)
- **WiFi Module:** NodeMCU ESP8266
- **Motor Controllers:** RioRand ZS-X11H (350W 6-60V Brushless with Hall)
- **Drive Motors:** Brushless Hub Motors (hoverboard-style with Hall sensors)

---

## Arduino Mega 2560

### Arduino Complete Specifications

The Arduino Mega 2560 is the main control board for the OmniTrek Nexus rover, providing extensive
I/O capabilities and multiple serial ports for communication.

#### Board Overview

| Specification                   | Value                               |
| ------------------------------- | ----------------------------------- |
| **Microcontroller**             | ATmega2560                          |
| **Operating Voltage**           | 5V                                  |
| **Input Voltage (recommended)** | 7-12V                               |
| **Input Voltage (limits)**      | 6-20V                               |
| **Digital I/O Pins**            | 54 (of which 15 provide PWM output) |
| **Analog Input Pins**           | 16                                  |
| **DC Current per I/O Pin**      | 20 mA                               |
| **DC Current for 3.3V Pin**     | 50 mA                               |
| **Flash Memory**                | 256 KB (8 KB used by bootloader)    |
| **SRAM**                        | 8 KB                                |
| **EEPROM**                      | 4 KB                                |
| **Clock Speed**                 | 16 MHz                              |
| **USB Connection**              | USB Type B                          |
| **Power Jack**                  | 2.1mm center-positive plug          |

#### Physical Dimensions

| Dimension          | Measurement           |
| ------------------ | --------------------- |
| **Length**         | 101.6 mm (4.0 inches) |
| **Width**          | 53.34 mm (2.1 inches) |
| **Weight**         | 37 g                  |
| **Mounting Holes** | 4x 3.2mm diameter     |

---

### ATmega2560 Microcontroller

The ATmega2560 is the heart of the Arduino Mega 2560, providing powerful processing capabilities for
embedded applications.

#### Core Architecture

| Feature               | Specification                                       |
| --------------------- | --------------------------------------------------- |
| **Architecture**      | 8-bit AVR RISC                                      |
| **CPU Speed**         | 16 MIPS @ 16 MHz                                    |
| **Instruction Set**   | 135 instructions, most single-clock-cycle execution |
| **Package**           | 100-pin TQFP (Thin Quad Flat Pack)                  |
| **Operating Voltage** | 4.5V - 5.5V                                         |
| **Temperature Range** | -40°C to +85°C (industrial grade)                   |

#### Memory Architecture

**Program Memory:**

- 256 KB Flash memory
- 8 KB used by bootloader (248 KB available for user programs)
- 10,000 write/erase cycles
- Can be programmed via ISP, JTAG, or bootloader

**Data Memory:**

- 8 KB Internal SRAM
- 4 KB EEPROM (100,000 write/erase cycles)
- Memory-mapped I/O registers

#### Peripheral Features

**Timers/Counters:**

- 2x 8-bit Timer/Counters with Separate Prescaler and Compare Mode
- 4x 16-bit Timer/Counter with Separate Prescaler, Compare and Capture Mode

**PWM Channels:**

- 15 PWM channels total
- Pins: 2-13, 44, 45, 46
- 8-bit resolution (0-255)
- Adjustable frequency

**Communication Interfaces:**

- 4x USART (hardware serial)
- 1x TWI (I2C) interface
- 1x SPI interface
- JTAG interface for debugging

**Analog Capabilities:**

- 16x 10-bit ADC channels
- 0-5V input range
- Approximate conversion time: 100 μs
- Resolution: ~4.9 mV per unit (5V / 1024)

**Digital I/O:**

- 86 programmable I/O lines
- 54 exposed on Arduino headers
- Internal pull-up resistors available
- High drive capability: 20 mA source/sink per pin

#### Interrupt System

- 8 external interrupt pins (INT0-INT7)
- Pin change interrupts on all I/O pins
- Timer interrupts
- Communication interrupts (UART, SPI, I2C)

---

### Arduino Pinout

#### Pin Categories and Functions

**Digital I/O Pins (0-53):**

```
Pin 0:  RX0  (Serial 0 Receive)
Pin 1:  TX0  (Serial 0 Transmit)
Pin 2:  PWM  (8-bit PWM output) / INT4
Pin 3:  PWM  (8-bit PWM output) / INT5
Pin 4:  PWM  (8-bit PWM output)
Pin 5:  PWM  (8-bit PWM output)
Pin 6:  PWM  (8-bit PWM output)
Pin 7:  PWM  (8-bit PWM output)
Pin 8:  PWM  (8-bit PWM output)
Pin 9:  PWM  (8-bit PWM output)
Pin 10: PWM  (8-bit PWM output)
Pin 11: PWM  (8-bit PWM output)
Pin 12: PWM  (8-bit PWM output)
Pin 13: PWM  (8-bit PWM output) / Built-in LED
Pin 14: TX3  (Serial 3 Transmit)
Pin 15: RX3  (Serial 3 Receive)
Pin 16: TX2  (Serial 2 Transmit)
Pin 17: RX2  (Serial 2 Receive)
Pin 18: TX1  (Serial 1 Transmit) / INT3
Pin 19: RX1  (Serial 1 Receive) / INT2
Pin 20: SDA  (I2C Data) / INT1
Pin 21: SCL  (I2C Clock) / INT0
Pin 22-53: General Digital I/O
Pin 44: PWM  (8-bit PWM output)
Pin 45: PWM  (8-bit PWM output)
Pin 46: PWM  (8-bit PWM output)
Pin 50: MISO (SPI)
Pin 51: MOSI (SPI)
Pin 52: SCK  (SPI)
Pin 53: SS   (SPI)
```

**Analog Input Pins (A0-A15):**

```
A0-A15: 10-bit analog input (0-5V range)
        Can also be used as digital I/O pins (54-69)
```

**Power Pins:**

```
VIN:    Input voltage to Arduino (7-12V recommended)
5V:     Regulated 5V output (max 800mA from regulator)
3.3V:   Regulated 3.3V output (max 50mA)
GND:    Ground (multiple pins available)
IOREF:  Reference voltage for shields (5V on Mega)
```

**Special Function Pins:**

```
AREF:   Analog reference voltage input for ADC
RESET:  Reset the microcontroller (active low)
```

#### External Interrupt Pins

| Pin | Interrupt | PCINTx | Notes                     |
| --- | --------- | ------ | ------------------------- |
| 2   | INT4      | PCINT4 | External interrupt 4      |
| 3   | INT5      | PCINT5 | External interrupt 5      |
| 18  | INT3      | -      | Can conflict with Serial1 |
| 19  | INT2      | -      | Can conflict with Serial1 |
| 20  | INT1      | -      | Can conflict with I2C     |
| 21  | INT0      | -      | Can conflict with I2C     |

---

### Arduino Serial Communication

The Arduino Mega 2560 features **four independent hardware UART serial ports**, making it ideal for
multi-device communication.

#### Serial Port Assignments

| Serial Port | RX Pin | TX Pin | Usage Notes                             |
| ----------- | ------ | ------ | --------------------------------------- |
| **Serial**  | 0      | 1      | USB programming port / PC communication |
| **Serial1** | 19     | 18     | Available for external devices          |
| **Serial2** | 17     | 16     | Available for external devices          |
| **Serial3** | 15     | 14     | Available for external devices          |

#### Serial Port Specifications

**Technical Details:**

- Full-duplex asynchronous serial communication
- Programmable baud rates: 300 to 2,000,000 bps
- Standard baud rates: 300, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200
- 5, 6, 7, 8, or 9 data bits
- None, even, or odd parity
- 1 or 2 stop bits
- Hardware RX/TX buffers (64 bytes each)

**Code Usage:**

```cpp
// Initialize serial ports
Serial.begin(115200);   // USB connection
Serial1.begin(9600);    // External device 1
Serial2.begin(19200);   // External device 2
Serial3.begin(115200);  // External device 3

// Reading data
if (Serial1.available()) {
  char data = Serial1.read();
}

// Writing data
Serial1.println("Hello World");
```

**Important Notes:**

- Pin 0 and 1 cannot be used for digital I/O when Serial is in use
- USB serial (Serial) shares connection with pins 0 and 1
- Each serial port has independent RX and TX buffers
- Maximum reliable baud rate depends on clock accuracy and cable length

---

### Arduino Power Specifications

#### Input Power Options

**1. USB Power:**

- Voltage: 5V DC
- Maximum Current: 500 mA (limited by polyfuse)
- Use Case: Programming and low-power operation

**2. DC Barrel Jack:**

- Connector: 2.1mm center-positive
- Recommended Voltage: 7-12V DC
- Absolute Limits: 6-20V DC
- Maximum Current:
  - Below 12V: Up to 1.5A
  - At 12V and above: Less than 1A (to prevent overheating)

**3. VIN Pin:**

- Same specifications as barrel jack
- Direct connection to voltage regulator input

#### Voltage Regulators

**5V Regulator (LD1117S50CTR or NCP1117ST50T3G):**

- Input Voltage: 6.5V - 15V (max)
- Output Voltage: 5V ± 5%
- Maximum Output Current: 800 mA (LD1117) / 1500 mA (NCP1117)
- Dropout Voltage: ~1.1V
- Quiescent Current: 6 mA typical, 10 mA max
- Thermal Protection: Yes
- Package: SOT-223

**3.3V Regulator (LP2985-33DBVR):**

- Input Voltage: 5V (from main regulator)
- Output Voltage: 3.3V ± 5%
- Maximum Output Current: 150 mA (limited to 50 mA on Arduino)
- Dropout Voltage: ~300 mV @ 50 mA
- Package: SOT-23-5

#### Power Consumption

**Board Current Draw (no peripherals):**

- Typical: 50-75 mA
- With USB connected: 70-72 mA
- Voltage regulator overhead: 6-10 mA
- Maximum (all I/O active): ~200 mA

**Per-Pin Current Limits:**

- DC Current per I/O Pin: 20 mA (absolute maximum: 40 mA)
- Total current from all I/O pins: 200 mA maximum
- 5V Pin Output: 800 mA max (limited by regulator)
- 3.3V Pin Output: 50 mA max (officially limited)

#### Power Supply Recommendations

**For Rover Application:**

- Use 7-12V external power supply via barrel jack or VIN
- Minimum 1A capacity recommended
- Separate motor power from logic power
- Use common ground between all power supplies
- Add bulk capacitors (100-1000μF) near power input

**Voltage Guidelines:**

- **Below 7V:** 5V rail may be unstable, board may malfunction
- **7-12V:** Optimal operating range, minimal heat generation
- **Above 12V:** Voltage regulator will overheat, reduce current draw
- **Above 15V:** Risk of regulator failure

---

### Arduino Programming Interface

#### Programming Methods

**1. USB Bootloader:**

- Protocol: STK500v2
- Baud Rate: 115200
- Bootloader Size: 8 KB
- Entry: Automatic on USB connection or manual reset
- LED Indication: Pin 13 LED blinks during upload

**2. ICSP (In-Circuit Serial Programming):**

- Protocol: SPI-based ISP
- Programmer: AVRISP mkII, USBasp, or Arduino as ISP
- Allows: Bootloader burning, fuse bit programming
- Pins: MISO, MOSI, SCK, RESET, VCC, GND

**3. JTAG Interface:**

- Full debugging capabilities
- Real-time code execution
- Breakpoints and variable watching
- Requires JTAG debugger hardware

#### Development Environments

**Arduino IDE:**

- Board: "Arduino Mega or Mega 2560"
- Processor: "ATmega2560"
- Port: Auto-detected USB serial port

**PlatformIO:**

```ini
[env:megaatmega2560]
platform = atmelavr
board = megaatmega2560
framework = arduino
```

#### Memory Usage Optimization

**Flash Memory (256 KB):**

- Use PROGMEM for constant data
- Minimize string literals
- Use F() macro for serial strings
- Enable LTO (Link Time Optimization)

**SRAM (8 KB):**

- Minimize global variables
- Use local variables when possible
- Avoid large arrays
- Use EEPROM for persistent data
- Monitor stack usage

---

## NodeMCU ESP8266

### NodeMCU Complete Specifications

The NodeMCU ESP8266 provides WiFi connectivity for the OmniTrek Nexus, enabling wireless
communication between the rover and the web interface.

#### Board Overview

| Specification         | Value                                  |
| --------------------- | -------------------------------------- |
| **WiFi Module**       | ESP-12E (ESP8266EX)                    |
| **CPU**               | Tensilica Xtensa 32-bit LX106 RISC     |
| **Clock Speed**       | 80 MHz / 160 MHz (adjustable)          |
| **Operating Voltage** | 3.3V                                   |
| **Input Voltage**     | 4.5V - 10V (via micro USB or VIN)      |
| **Flash Memory**      | 4 MB (32 Mbit)                         |
| **SRAM**              | 128 KB (64 KB instruction, 96 KB data) |
| **GPIO Pins**         | 17 (11 usable for I/O)                 |
| **Analog Input**      | 1 (10-bit ADC, 0-1V)                   |
| **PWM Pins**          | 4                                      |
| **UART**              | 2 (UART0, UART1)                       |
| **SPI**               | 1                                      |
| **I2C**               | 1 (software implementation)            |
| **WiFi Protocol**     | 802.11 b/g/n @ 2.4 GHz                 |

#### Board Variants and Dimensions

**NodeMCU V2 (Amica):**

- Dimensions: 48mm × 26mm × 12mm
- Pin Spacing: 0.1" (2.54mm) between pins
- Row Spacing: 0.9" (22.86mm) between rows
- USB: Micro USB

**NodeMCU V3 (LoLin):**

- Dimensions: 58mm × 31mm × 12mm
- Pin Spacing: 0.1" (2.54mm) between pins
- Row Spacing: 1.0" (25.4mm) between rows
- USB: Micro USB
- Additional: Larger board with same functionality

---

### ESP8266EX Chip Details

The ESP8266EX is a highly integrated WiFi SoC designed for IoT applications, providing a complete
WiFi networking solution.

#### CPU Architecture

| Feature             | Specification                                     |
| ------------------- | ------------------------------------------------- |
| **Processor**       | Tensilica Xtensa Diamond Standard 106Micro 32-bit |
| **Architecture**    | RISC, L106                                        |
| **Clock Frequency** | 80 MHz (default), 160 MHz (overclocked)           |
| **Instruction RAM** | 64 KB                                             |
| **Data RAM**        | 96 KB                                             |
| **Boot ROM**        | 64 KB                                             |
| **Performance**     | DMIPS 0.9 @ 80 MHz                                |

#### Memory Architecture

**Internal Memory:**

- 64 KB instruction RAM (iRAM)
- 96 KB data RAM (dRAM)
- 64 KB boot ROM

**External Flash (SPI):**

- Size: 4 MB (512 KB to 16 MB supported)
- Interface: SPI (up to 80 MHz)
- Use: Program storage, file system (SPIFFS/LittleFS)

**Cache:**

- 32 KB instruction cache
- Memory-mapped flash access

#### Peripheral Features

**WiFi Subsystem:**

- IEEE 802.11 b/g/n (2.4 GHz only)
- Integrated RF switch, balun, LNA, PA
- Supports WPA/WPA2 security
- WiFi Direct (P2P), soft-AP
- Integrated TCP/IP protocol stack

**GPIO:**

- 17 GPIO pins (multiplexed functions)
- All GPIOs support interrupt/pwm/I2C/one-wire
- Internal pull-up/pull-down resistors (45 KΩ)
- Drive strength: ~12 mA

**ADC:**

- 10-bit SAR ADC
- Single channel (TOUT)
- Input voltage: 0 - 1.0V
- Can measure VDD with limitation

**Timers:**

- 1× hardware timer
- Software timers available in SDK
- Watchdog timer

**Real-Time Clock (RTC):**

- Ultra-low power RTC for deep sleep
- Can count time during deep sleep
- Battery backup option (external circuit)

**Communication Interfaces:**

- **UART:** 2 interfaces (UART0 full duplex, UART1 TX only)
  - Baud rate: 300 bps to 4.5 Mbps
  - Hardware flow control support

- **SPI:** 2 interfaces (1 for flash, 1 general purpose)
  - Master/Slave modes
  - Speed: Up to 80 MHz

- **I2C:** Software implementation (bit-banging)
  - Default: GPIO4 (SDA), GPIO5 (SCL)
  - Adjustable to any GPIO pins

- **I2S:** Digital audio interface
  - For audio input/output
  - DMA support

#### Security Features

- WEP, WPA/WPA2 PSK/Enterprise
- Hardware acceleration for encryption
- Random number generator (RNG)

---

### NodeMCU Pinout

#### Pin Mapping and Functions

The NodeMCU uses a different pin labeling (D0-D10) compared to the ESP8266 GPIO numbers.
Understanding both is critical for programming.

**Complete Pin Mapping:**

| NodeMCU Label     | ESP8266 GPIO | Function          | Notes                                        |
| ----------------- | ------------ | ----------------- | -------------------------------------------- |
| **D0**            | GPIO16       | Digital I/O       | No interrupt, no PWM, wake from deep sleep   |
| **D1**            | GPIO5        | Digital I/O, SCL  | I2C Clock (default)                          |
| **D2**            | GPIO4        | Digital I/O, SDA  | I2C Data (default)                           |
| **D3**            | GPIO0        | Digital I/O       | FLASH button, pulled up, boot mode           |
| **D4**            | GPIO2        | Digital I/O       | Built-in LED (active low), boot mode         |
| **D5**            | GPIO14       | Digital I/O, SCK  | SPI Clock                                    |
| **D6**            | GPIO12       | Digital I/O, MISO | SPI Master In Slave Out                      |
| **D7**            | GPIO13       | Digital I/O, MOSI | SPI Master Out Slave In                      |
| **D8**            | GPIO15       | Digital I/O, SS   | SPI Slave Select, boot mode (pull-down)      |
| **D9** / **SD2**  | GPIO9        | Flash             | Connected to flash chip (do not use)         |
| **D10** / **SD3** | GPIO10       | Flash             | Connected to flash chip (do not use)         |
| **RX**            | GPIO3        | UART0 RX          | Serial receive, also used for programming    |
| **TX**            | GPIO1        | UART0 TX          | Serial transmit, also used for programming   |
| **A0**            | ADC0         | Analog Input      | 10-bit ADC, 0-1V (3.3V with voltage divider) |

**Power Pins:**

| Pin     | Function      | Specifications                      |
| ------- | ------------- | ----------------------------------- |
| **VIN** | Voltage Input | 4.5V - 10V (powers 3.3V regulator)  |
| **3V3** | 3.3V Output   | Max 600 mA (from onboard regulator) |
| **GND** | Ground        | Multiple pins available             |
| **RST** | Reset         | Active low, pulled up               |
| **EN**  | Chip Enable   | Active high, pulled up              |

#### Boot Mode Pins

These pins determine the boot mode of the ESP8266:

| GPIO   | Pin | Boot Mode                                        | Normal Operation              |
| ------ | --- | ------------------------------------------------ | ----------------------------- |
| GPIO0  | D3  | Must be HIGH for normal boot, LOW for flash mode | Can be used as I/O after boot |
| GPIO2  | D4  | Must be HIGH at boot                             | Can be used as I/O after boot |
| GPIO15 | D8  | Must be LOW at boot                              | Can be used as I/O after boot |

**Boot Mode Selection:**

- GPIO0=HIGH, GPIO2=HIGH, GPIO15=LOW: Boot from flash (normal mode)
- GPIO0=LOW, GPIO2=HIGH, GPIO15=LOW: UART download mode (programming)

#### Pin Constraints and Limitations

**Unusable Pins:**

- **GPIO9, GPIO10 (SD2, SD3):** Connected to flash chip, do not use
- **GPIO6, GPIO7, GPIO8, GPIO11:** Connected to flash chip, not broken out

**Limited Use Pins:**

- **GPIO16 (D0):** No interrupt support, no PWM, used for deep sleep wake
- **GPIO1 (TX), GPIO3 (RX):** UART pins, serial output during boot
- **GPIO0, GPIO2, GPIO15:** Boot mode pins, specific pull requirements

**Safe to Use Pins:**

- **GPIO4 (D2), GPIO5 (D1):** Good for I2C
- **GPIO12 (D6), GPIO13 (D7), GPIO14 (D5):** Good for SPI
- **GPIO16 (D0):** Good for wake from deep sleep

#### PWM Pins

All GPIO pins (except GPIO16) can provide PWM output:

- Software PWM implementation
- 10-bit resolution (0-1023)
- Frequency: 1 kHz default (adjustable)
- Maximum 4 PWM channels recommended for stability

---

### NodeMCU WiFi Specifications

#### WiFi Physical Layer

**Frequency and Channels:**

- Frequency Range: 2.4 GHz - 2.5 GHz (2400 MHz - 2483.5 MHz)
- WiFi Standard: IEEE 802.11 b/g/n
- Channels: 14 (1-14), availability depends on region
  - North America: Channels 1-11
  - Europe: Channels 1-13
  - Japan: Channels 1-14

**Antenna:**

- Type: PCB trace antenna (onboard)
- Antenna Gain: ~2 dBi
- Output Power: +19.5 dBm (802.11b), +16 dBm (802.11n)
- Receiver Sensitivity:
  - 802.11b (11 Mbps): -91 dBm
  - 802.11g (54 Mbps): -75 dBm
  - 802.11n (MCS7): -72 dBm

#### WiFi Modes

**Station Mode (STA):**

- Connect to existing WiFi network
- Acts as WiFi client
- Receives IP from DHCP or static configuration

**Access Point Mode (AP):**

- Creates WiFi hotspot
- Other devices can connect
- Provides DHCP to clients
- Limited to 4-8 simultaneous connections

**Station + AP Mode (Dual Mode):**

- Operates as both station and AP simultaneously
- Can bridge networks
- Useful for mesh networking

**WiFi Direct (P2P):**

- Direct device-to-device connection
- No router required

#### Network Protocols

**Transport Layer:**

- TCP (Transmission Control Protocol)
- UDP (User Datagram Protocol)
- Maximum 5 concurrent TCP connections (default SDK)

**Application Layer:**

- HTTP client/server
- HTTPS (with limitations due to memory)
- MQTT (lightweight messaging)
- WebSocket (bidirectional communication)
- mDNS (service discovery)
- DNS client
- DHCP client/server
- SNTP (time synchronization)

#### Security

**Encryption Standards:**

- WEP (not recommended)
- WPA-PSK (TKIP)
- WPA2-PSK (AES)
- WPA/WPA2 Enterprise (with limitations)

**TLS/SSL:**

- TLS 1.1, 1.2 support
- Limited by available RAM
- Certificate validation support

---

### NodeMCU Power Specifications

#### Operating Voltage

| Parameter                | Value             |
| ------------------------ | ----------------- |
| **Supply Voltage (VIN)** | 4.5V - 10V        |
| **Chip Voltage (3.3V)**  | 3.0V - 3.6V       |
| **Recommended**          | 5V via USB or VIN |

#### Current Consumption

**Active Modes:**

| Mode                       | Current Draw | Notes                       |
| -------------------------- | ------------ | --------------------------- |
| **Transmitting (802.11b)** | 170 mA       | Peak during TX burst        |
| **Transmitting (802.11n)** | 140 mA       | Peak during TX burst        |
| **Receiving**              | 50 - 70 mA   | Varies with signal strength |
| **WiFi Connected (idle)**  | 15 - 20 mA   | Maintaining connection      |
| **CPU Active (no WiFi)**   | 80 mA        | Processing only             |
| **Normal Operation**       | 70 - 80 mA   | Typical application average |

**Low Power Modes:**

| Mode                           | Current Draw       | Wake Options      | Notes                         |
| ------------------------------ | ------------------ | ----------------- | ----------------------------- |
| **Modem Sleep**                | 15 - 20 mA         | N/A               | WiFi off, CPU active          |
| **Light Sleep**                | 0.4 - 0.9 mA       | GPIO, Timer       | CPU suspended                 |
| **Deep Sleep**                 | 20 μA (chip alone) | RTC Timer, GPIO16 | Everything off except RTC     |
| **Deep Sleep (NodeMCU board)** | 8 - 20 mA          | RTC Timer, GPIO16 | Board components add overhead |
| **Power Off**                  | < 5 μA             | Manual            | No wake capability            |

#### Power Modes Explained

**1. Active Mode (Normal Operation):**

- All systems operational
- WiFi transmitting/receiving
- CPU running at full speed
- Current: 70-170 mA depending on activity

**2. Modem Sleep Mode:**

- WiFi radio turned off
- CPU remains active
- Can process data, read sensors
- Wakes automatically for WiFi activity
- Entry: `WiFi.setSleepMode(WIFI_LIGHT_SLEEP);`

**3. Light Sleep Mode:**

- WiFi and CPU suspended
- Peripherals remain powered
- Fast wake-up (~3 ms)
- Wake sources: GPIO interrupt, timer
- Entry: `wifi_set_sleep_type(LIGHT_SLEEP_T);`

**4. Deep Sleep Mode:**

- Everything powered off except RTC
- Lowest power consumption
- Wake sources: Timer or GPIO16 (D0)
- Requires GPIO16 connected to RST
- Wake-up time: ~300 ms
- Entry: `ESP.deepSleep(microseconds);`

**Deep Sleep Wiring:**

```
GPIO16 (D0) -----> RST
```

This connection allows the RTC timer to reset the chip after deep sleep expires.

#### Voltage Regulator

**Onboard Regulator (AMS1117-3.3):**

- Input Voltage: 4.5V - 15V
- Output Voltage: 3.3V ± 3%
- Maximum Current: 800 mA - 1000 mA
- Dropout Voltage: ~1.2V
- Quiescent Current: 5 mA
- Package: SOT-223

**Power Supply Recommendations:**

- Use stable 5V supply (USB or regulated)
- Minimum 500 mA capacity
- Add 10 μF ceramic + 100 μF electrolytic capacitors near ESP8266
- Avoid voltage drops during WiFi transmission
- Use thick power traces on PCB

#### Power Consumption Optimization

**Software Strategies:**

- Use deep sleep between measurements
- Reduce WiFi transmit power: `WiFi.setOutputPower(power);`
- Minimize active time
- Use light sleep during idle periods
- Optimize code for speed (less active time)

**Hardware Strategies:**

- Remove power LED to save 1-2 mA
- Use buck converter instead of linear regulator
- Add bulk capacitors (470 μF+) at power input
- Use battery-efficient sensors
- Consider external RTC for long sleep periods

---

### NodeMCU Programming Interface

#### Programming Methods

**1. USB Serial Programming (Default):**

- Uses CH340G or CP2102 USB-to-Serial chip
- Auto-reset and auto-program circuitry
- No button pressing required (usually)
- Baud rate: 115200 (can use up to 921600)

**2. External Serial Adapter:**

- Connect TX→RX, RX→TX, GND→GND
- Must manually enter flash mode
- Hold FLASH button, press RESET, release FLASH

**3. OTA (Over-The-Air):**

- Update firmware via WiFi
- Requires OTA library and initial program
- Can update remotely

#### Development Environments

**Arduino IDE:**

- Board: "NodeMCU 1.0 (ESP-12E Module)"
- Upload Speed: 115200 (stable) or 921600 (fast)
- CPU Frequency: 80 MHz or 160 MHz
- Flash Size: 4MB (FS:2MB OTA:~1019KB)

**Board Manager URL:**

```
http://arduino.esp8266.com/stable/package_esp8266com_index.json
```

**PlatformIO:**

```ini
[env:nodemcuv2]
platform = espressif8266
board = nodemcuv2
framework = arduino
upload_speed = 921600
monitor_speed = 115200
```

**ESPHome:**

- YAML-based configuration
- No coding required
- Ideal for home automation

**MicroPython:**

- Python on ESP8266
- Interactive REPL
- Slower than compiled C++

**NodeMCU Lua:**

- Original firmware
- Lua scripting language
- Event-driven programming

#### Flash Memory Layout

**4MB Flash Configuration:**

```
0x000000 - 0x0FFFFF:  Bootloader and system (1 MB)
0x100000 - 0x2FFFFF:  Application code (2 MB)
0x300000 - 0x3FFFFF:  File system (SPIFFS/LittleFS) (1 MB)
```

**File System:**

- SPIFFS (deprecated) or LittleFS (recommended)
- Store configuration files, web pages, certificates
- Access via `SPIFFS.begin()` or `LittleFS.begin()`

#### Library Compatibility

**Core ESP8266 Libraries:**

- ESP8266WiFi - WiFi functionality
- ESP8266WebServer - HTTP server
- ESP8266HTTPClient - HTTP client
- ESP8266mDNS - Service discovery
- WiFiManager - Easy WiFi configuration
- ArduinoOTA - Over-the-air updates
- Ticker - Software timers
- EEPROM - Emulated EEPROM storage

**Most Arduino libraries work with modifications:**

- Replace `Serial` with software serial if needed
- Account for 3.3V logic levels
- Consider memory limitations
- Timing may differ from AVR Arduino

---

## RioRand ZS-X11H Motor Controller

The OmniTrek Nexus rover uses the **RioRand 350W 6-60V Brushless Motor Controller with Hall Sensor
(ZS-X11H)** for controlling the hoverboard hub motors. This controller provides precise motor
control using Hall sensor feedback.

### Overview

The ZS-X11H is a high-performance brushless DC motor driver designed specifically for 3-phase motors
with Hall sensors. It's commonly used for hoverboard motors, electric scooters, e-bikes, and
robotics applications.

**Model Numbers:**

- ZS-X11H (current version)
- ZS-X11H V2 (updated version with additional STOP input)
- ZS-Z11H (older variant, similar functionality)

---

### Complete Specifications

**Electrical Specifications:**

| Parameter                  | Value                                         | Notes                       |
| -------------------------- | --------------------------------------------- | --------------------------- |
| **Model Number**           | ZS-X11H / ZS-X11H V2                          | V2 has additional STOP pin  |
| **Input Voltage Range**    | 6V - 60V DC                                   | Maximum 60V absolute limit  |
| **Rated Voltage**          | 9V - 60V DC                                   | Recommended operating range |
| **Rated Power**            | 350W                                          | Continuous operation        |
| **Maximum Power**          | 400W                                          | Peak/short duration         |
| **Rated Current**          | 16A                                           | Continuous                  |
| **Peak Current**           | 20A                                           | Short bursts                |
| **Motor Type**             | 3-phase BLDC with Hall sensors                | 120° electrical angle only  |
| **Hall Sensor Voltage**    | 5V ± 0.5V                                     | Provided by controller      |
| **Control Method**         | PWM or 0-5V Analog                            | Two input modes             |
| **PWM Signal Voltage**     | 2.5V - 5V                                     | Logic level input           |
| **Analog Control Voltage** | 0V - 5V DC                                    | Linear speed control        |
| **Operating Temperature**  | -20°C to +50°C                                | Ambient temperature         |
| **Protection Features**    | Over-current, Under-voltage, Speed adjustment | Multiple safety systems     |
| **Dimensions**             | 63mm × 45mm × 31mm                            | Board size (V2)             |
| **Weight**                 | ~80g                                          | Approximate                 |

**Key Features:**

- **Hall Sensor Feedback:** Precise position-based motor control with smooth operation
- **Wide Voltage Range:** Compatible with 12V, 24V, 36V, and 48V systems (up to 60V)
- **Dual Control Modes:** PWM signal input or 0-5V analog voltage control
- **Onboard Potentiometer:** Manual speed adjustment via built-in pot (when jumper installed)
- **Direction Control:** Independent FWD and REV inputs for bidirectional operation
- **Brake Function:** Active braking capability for quick stops
- **Stop Function:** Emergency stop input (V2 model)
- **LED Status Indicators:** Power and operational status LEDs
- **Multiple Protections:** Over-current, under-voltage, and thermal protection
- **Speed Pulse Output:** Optional feedback signal for speed monitoring (select models)

**Applications:**

- Hoverboard and self-balancing vehicle conversions
- Electric scooters and e-bikes
- Mobile robots and rovers
- Electric skateboards
- Small electric vehicles
- Automation and conveyor systems

---

### Detailed Pinout and Connections

The ZS-X11H has multiple connector types for power, motor, Hall sensors, and control signals.

#### Power Terminals (Screw Terminals or Large Pads)

| Terminal        | Wire Color | Function             | Specifications                        |
| --------------- | ---------- | -------------------- | ------------------------------------- |
| **VCC** / **+** | Red        | Positive power input | 6-60V DC, connect to battery positive |
| **GND** / **-** | Black      | Negative/Ground      | Connect to battery negative           |
| **MA** / **U**  | Yellow     | Motor Phase A/U      | Connect to motor phase wire           |
| **MB** / **V**  | Green      | Motor Phase B/V      | Connect to motor phase wire           |
| **MC** / **W**  | Blue       | Motor Phase C/W      | Connect to motor phase wire           |

**Important Power Notes:**

- Use wire gauge appropriate for current (14-16 AWG for 20A)
- Keep power wires short to minimize voltage drop
- Add 1000μF or larger capacitor across VCC and GND near controller
- Double-check polarity before powering on!

---

#### Control Signal Header (10-Pin Header)

The control header typically has either a 10-pin JST connector or requires soldering a header.

| Pin # | Label   | Function          | Type             | Specifications                                |
| ----- | ------- | ----------------- | ---------------- | --------------------------------------------- |
| 1     | **GND** | Signal Ground     | Ground           | Common ground for all control signals         |
| 2     | **FWD** | Forward Enable    | Digital Input    | Active LOW - connect to GND for forward       |
| 3     | **REV** | Reverse Enable    | Digital Input    | Active LOW - connect to GND for reverse       |
| 4     | **BRK** | Brake             | Digital Input    | Active HIGH - connect to +5V to brake         |
| 5     | **PWM** | Speed Control PWM | PWM/Analog Input | 2.5-5V PWM or 0-5V analog                     |
| 6     | **+5V** | 5V Output         | Power Output     | Regulated 5V, max ~100mA for control circuits |
| 7     | **Ha**  | Hall Sensor A     | Hall Input       | 0-5V digital, from motor Hall sensor A        |
| 8     | **Hb**  | Hall Sensor B     | Hall Input       | 0-5V digital, from motor Hall sensor B        |
| 9     | **Hc**  | Hall Sensor C     | Hall Input       | 0-5V digital, from motor Hall sensor C        |
| 10    | **GND** | Hall Ground       | Ground           | Hall sensor ground (common with Pin 1)        |

**Additional Pins (select models):**

- **STOP:** Emergency stop input (V2 model) - connect to +5V to stop
- **SC:** Speed pulse output - provides feedback pulses proportional to motor RPM

---

#### Hall Sensor Connector (5-Wire Cable from Motor)

Most hoverboard motors have a 5-wire cable for Hall sensors:

| Motor Wire Color | Controller Pin | Function      | Voltage |
| ---------------- | -------------- | ------------- | ------- |
| Red              | +5V (Pin 6)    | Hall Power    | 5V DC   |
| Black            | GND (Pin 10)   | Hall Ground   | 0V      |
| Yellow           | Ha (Pin 7)     | Hall Sensor A | 0-5V    |
| Green            | Hb (Pin 8)     | Hall Sensor B | 0-5V    |
| Blue             | Hc (Pin 9)     | Hall Sensor C | 0-5V    |

**Note:** Some motors may use different wire colors. Use a multimeter to identify:

- Power (+5V): Usually red
- Ground: Usually black
- Hall signals: Three remaining wires, can be tested with multimeter while rotating motor

---

### Control Modes and Logic

#### Direction Control

The ZS-X11H uses **active-low** logic for direction control:

| FWD Pin        | REV Pin        | Result        | Notes                  |
| -------------- | -------------- | ------------- | ---------------------- |
| LOW (GND)      | HIGH (open/5V) | **Forward**   | Motor rotates forward  |
| HIGH (open/5V) | LOW (GND)      | **Reverse**   | Motor rotates backward |
| HIGH           | HIGH           | **Stop**      | Motor is stopped       |
| LOW            | LOW            | **Undefined** | Avoid this state!      |

**From Arduino:**

```cpp
// Set direction pins
const int motorFWD = 7;
const int motorREV = 8;

// Forward
digitalWrite(motorFWD, LOW);
digitalWrite(motorREV, HIGH);

// Reverse
digitalWrite(motorFWD, HIGH);
digitalWrite(motorREV, LOW);

// Stop
digitalWrite(motorFWD, HIGH);
digitalWrite(motorREV, HIGH);
```

---

#### Brake Function

The brake input is **active-high**:

| BRK Pin           | Result                               |
| ----------------- | ------------------------------------ |
| LOW (GND or open) | Normal operation                     |
| HIGH (+5V)        | Active braking - motor stops quickly |

**Braking Behavior:**

- When BRK is HIGH, motor is actively braked (regenerative braking)
- Creates strong stopping force
- Both FWD and REV should be HIGH when braking

**⚠️ CRITICAL WARNING:** **DO NOT activate brake at high speed with high voltage!** The controller
manual specifically warns:

- Reduce speed throttle to below 50% before braking
- Forward/reverse switching uses non-delayed hard commutation
- High-speed braking can damage the controller
- Always slow down before changing direction or braking

---

#### Speed Control Modes

The ZS-X11H supports two speed control modes:

**Mode 1: PWM Signal Control (Recommended for Arduino)**

| Parameter       | Specification                      |
| --------------- | ---------------------------------- |
| Signal Type     | PWM (Pulse Width Modulation)       |
| Voltage         | 2.5V - 5V (3.3V and 5V compatible) |
| Frequency       | 1 kHz - 10 kHz (1 kHz recommended) |
| Duty Cycle      | 0% = Stop, 100% = Full Speed       |
| Input Impedance | High (pulled down internally)      |

**Setup for PWM Mode:**

1. Remove jumper cap from PWM header (if installed)
2. Set PWM signal to 0% (LOW) momentarily for stability
3. Connect PWM signal from microcontroller to PWM pin
4. Connect GND from microcontroller to controller GND

**Arduino Example:**

```cpp
const int motorPWM = 9;  // Use PWM-capable pin

void setup() {
  pinMode(motorPWM, OUTPUT);

  // Set PWM frequency to 1 kHz (Timer 2 for pins 9, 10)
  TCCR2B = (TCCR2B & 0b11111000) | 0x04;  // Prescaler = 64

  // Initialize to 0
  analogWrite(motorPWM, 0);
}

void setSpeed(int speed) {
  // speed: 0-255 (0 = stop, 255 = full)
  analogWrite(motorPWM, speed);
}
```

**Mode 2: Analog Voltage Control (0-5V)**

| Parameter       | Specification                       |
| --------------- | ----------------------------------- |
| Signal Type     | DC Analog Voltage                   |
| Voltage Range   | 0V - 5V DC                          |
| Speed Mapping   | Linear (0V = stop, 5V = full speed) |
| Input Impedance | ~10kΩ typical                       |

**Setup for Analog Mode:**

1. Install jumper cap to enable onboard potentiometer (optional)
2. Or connect external 0-5V source to PWM pin
3. Voltage can come from DAC, filtered PWM, or potentiometer divider

**Converting Arduino PWM to Analog:**

```
Arduino PWM Pin ──[1kΩ]──┬── To Controller PWM/Analog Input
                          │
                        [10μF]
                          │
                         GND

Cutoff frequency ≈ 16 Hz
```

---

### Hardware Setup and Jumper Configuration

#### Jumper Settings

**PWM/Analog Select Jumper:**

- **Jumper ON:** Enables onboard potentiometer for manual speed control
- **Jumper OFF:** External PWM/analog signal input mode (recommended for Arduino control)

**Header Soldering:** Some ZS-X11H boards come without pre-soldered headers:

- **2-pin header** needed for PWM jumper cap
- **JST connector** or pin headers for control signals
- **Optional:** Solder wire leads directly for permanent installation

---

### LED Status Indicators

| LED        | Color      | Indication                                                                                                 |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| **PWR**    | Red        | Power LED - Lights when controller receives power                                                          |
| **Status** | Green/Blue | Operational status:<br>- Solid: Normal operation<br>- Blinking: Possible fault<br>- Off: No power or fault |

**Troubleshooting with LEDs:**

- Power LED off: Check power connections and voltage
- Status LED blinking: Check Hall sensor connections, motor phases, or over-current condition
- Both LEDs dim: Insufficient power supply current capacity

---

### Important Operating Notes and Warnings

#### ⚠️ CRITICAL SAFETY WARNINGS

1. **Motor Compatibility:**
   - **ONLY compatible with 120° electrical angle DC brushless motors with Hall sensors**
   - **NOT compatible with 60° motors** - will not work correctly
   - **Hall sensors are REQUIRED** - will not operate in sensorless mode

2. **High-Speed Direction Changes:**
   - **NEVER switch direction at full speed with high voltage!**
   - Controller uses non-delayed hard commutation for direction changes
   - **Reduce throttle to below 50% before switching direction**
   - Failure to follow this can damage the controller permanently

3. **Braking at High Speed:**
   - **DO NOT activate brake when motor runs at full speed under high voltage**
   - Causes significant electrical and mechanical impact
   - Always reduce speed first, then apply brake

4. **Power Supply Requirements:**
   - Use power supply capable of 20A+ peak current
   - Voltage must remain stable under load
   - Add large capacitor (1000μF+) at controller input
   - Use appropriate fuse rating (20-30A)

5. **Hall Sensor Voltage:**
   - **Hall sensors MUST receive exactly 5V, not 3.3V!**
   - The controller provides regulated 5V on Pin 6
   - Using wrong voltage will cause erratic motor behavior

6. **Heat Management:**
   - Controller can get hot under continuous high-current operation
   - Ensure adequate airflow or add heatsink
   - Do not enclose in sealed container without ventilation
   - Operating temperature range: -20°C to +50°C

---

### Complete Arduino Example for ZS-X11H

Here's a complete Arduino sketch for controlling a single ZS-X11H motor controller:

```cpp
/*
 * ZS-X11H Brushless Motor Controller - Arduino Control Example
 * Compatible with Arduino Mega 2560 and hoverboard hub motors
 *
 * Hardware Connections:
 * - PWM control: Arduino Pin 9 -> Controller PWM pin
 * - Forward:     Arduino Pin 7 -> Controller FWD pin
 * - Reverse:     Arduino Pin 8 -> Controller REV pin
 * - Brake:       Arduino Pin 6 -> Controller BRK pin (optional)
 * - GND:         Arduino GND -> Controller GND
 * - Motor:       3 phase wires to controller U, V, W
 * - Hall:        5 Hall wires to controller Hall connector
 * - Power:       Battery+ to VCC, Battery- to GND
 */

// Pin definitions
const int MOTOR_PWM = 9;    // PWM speed control (must be PWM pin)
const int MOTOR_FWD = 7;    // Forward direction (active low)
const int MOTOR_REV = 8;    // Reverse direction (active low)
const int MOTOR_BRK = 6;    // Brake (active high)

// Motor state
enum MotorDirection {
  MOTOR_STOP,
  MOTOR_FORWARD,
  MOTOR_REVERSE,
  MOTOR_BRAKE
};

void setup() {
  Serial.begin(115200);
  Serial.println("ZS-X11H Motor Controller Test");

  // Configure pins
  pinMode(MOTOR_PWM, OUTPUT);
  pinMode(MOTOR_FWD, OUTPUT);
  pinMode(MOTOR_REV, OUTPUT);
  pinMode(MOTOR_BRK, OUTPUT);

  // Set PWM frequency to 1 kHz (Timer 2 for pins 9, 10)
  // This provides better compatibility with the ZS-X11H
  TCCR2B = (TCCR2B & 0b11111000) | 0x04;  // Prescaler = 64

  // Initialize motor to stopped state
  stopMotor();

  Serial.println("Motor controller initialized");
  Serial.println("Commands: f=forward, r=reverse, s=stop, b=brake, 0-9=speed");
}

void loop() {
  // Check for serial commands
  if (Serial.available() > 0) {
    char command = Serial.read();
    handleCommand(command);
  }

  // Add your motor control logic here
}

// Set motor speed (0-255)
void setMotorSpeed(int speed) {
  speed = constrain(speed, 0, 255);
  analogWrite(MOTOR_PWM, speed);
}

// Set motor direction
void setMotorDirection(MotorDirection dir) {
  switch (dir) {
    case MOTOR_FORWARD:
      digitalWrite(MOTOR_FWD, LOW);   // Active low
      digitalWrite(MOTOR_REV, HIGH);
      digitalWrite(MOTOR_BRK, LOW);
      Serial.println("Direction: FORWARD");
      break;

    case MOTOR_REVERSE:
      digitalWrite(MOTOR_FWD, HIGH);
      digitalWrite(MOTOR_REV, LOW);   // Active low
      digitalWrite(MOTOR_BRK, LOW);
      Serial.println("Direction: REVERSE");
      break;

    case MOTOR_STOP:
      digitalWrite(MOTOR_FWD, HIGH);
      digitalWrite(MOTOR_REV, HIGH);
      digitalWrite(MOTOR_BRK, LOW);
      Serial.println("Direction: STOP");
      break;

    case MOTOR_BRAKE:
      digitalWrite(MOTOR_FWD, HIGH);
      digitalWrite(MOTOR_REV, HIGH);
      digitalWrite(MOTOR_BRK, HIGH);  // Active high
      Serial.println("Direction: BRAKE");
      break;
  }
}

// Stop motor safely
void stopMotor() {
  setMotorSpeed(0);
  setMotorDirection(MOTOR_STOP);
}

// Handle serial commands for testing
void handleCommand(char cmd) {
  static int currentSpeed = 0;

  switch (cmd) {
    case 'f':  // Forward
      setMotorDirection(MOTOR_FORWARD);
      break;

    case 'r':  // Reverse
      // IMPORTANT: Reduce speed before changing direction!
      if (currentSpeed > 128) {
        Serial.println("WARNING: Reducing speed before reverse");
        setMotorSpeed(128);
        delay(500);
      }
      setMotorDirection(MOTOR_REVERSE);
      break;

    case 's':  // Stop
      stopMotor();
      currentSpeed = 0;
      break;

    case 'b':  // Brake
      // IMPORTANT: Reduce speed before braking!
      if (currentSpeed > 128) {
        Serial.println("WARNING: Reducing speed before brake");
        setMotorSpeed(128);
        delay(500);
      }
      setMotorDirection(MOTOR_BRAKE);
      currentSpeed = 0;
      break;

    case '0' ... '9':  // Speed control (0-9)
      currentSpeed = map(cmd - '0', 0, 9, 0, 255);
      setMotorSpeed(currentSpeed);
      Serial.print("Speed: ");
      Serial.println(currentSpeed);
      break;

    default:
      Serial.println("Unknown command");
      Serial.println("f=forward, r=reverse, s=stop, b=brake, 0-9=speed");
  }
}

/*
 * Advanced Function: Set motor with direction and speed
 * speed: -255 to +255 (negative = reverse, positive = forward)
 */
void setMotor(int speed) {
  static int lastSpeed = 0;

  // Check if changing direction at high speed
  if ((speed > 0 && lastSpeed < -128) || (speed < 0 && lastSpeed > 128)) {
    Serial.println("WARNING: High-speed direction change detected!");
    Serial.println("Reducing speed first...");

    // Gradually reduce speed
    int intermediateSpeed = (speed > 0) ? 64 : -64;
    setMotor(intermediateSpeed);
    delay(300);
  }

  // Set direction
  if (speed > 0) {
    setMotorDirection(MOTOR_FORWARD);
    analogWrite(MOTOR_PWM, speed);
  } else if (speed < 0) {
    setMotorDirection(MOTOR_REVERSE);
    analogWrite(MOTOR_PWM, -speed);
  } else {
    setMotorDirection(MOTOR_STOP);
    analogWrite(MOTOR_PWM, 0);
  }

  lastSpeed = speed;
}
```

---

### Dual Motor Control Example (Rover Application)

For controlling two motors (left and right) for a rover:

```cpp
/*
 * Dual ZS-X11H Motor Controller - Rover Control
 */

// Left motor pins
const int LEFT_PWM = 9;
const int LEFT_FWD = 7;
const int LEFT_REV = 8;

// Right motor pins
const int RIGHT_PWM = 10;
const int RIGHT_FWD = 5;
const int RIGHT_REV = 6;

void setup() {
  // Configure left motor
  pinMode(LEFT_PWM, OUTPUT);
  pinMode(LEFT_FWD, OUTPUT);
  pinMode(LEFT_REV, OUTPUT);

  // Configure right motor
  pinMode(RIGHT_PWM, OUTPUT);
  pinMode(RIGHT_FWD, OUTPUT);
  pinMode(RIGHT_REV, OUTPUT);

  // Set PWM frequency to 1 kHz
  TCCR2B = (TCCR2B & 0b11111000) | 0x04;  // Pins 9, 10

  // Initialize both motors to stop
  stopBothMotors();
}

void setLeftMotor(int speed) {
  if (speed > 0) {
    digitalWrite(LEFT_FWD, LOW);
    digitalWrite(LEFT_REV, HIGH);
    analogWrite(LEFT_PWM, speed);
  } else if (speed < 0) {
    digitalWrite(LEFT_FWD, HIGH);
    digitalWrite(LEFT_REV, LOW);
    analogWrite(LEFT_PWM, -speed);
  } else {
    digitalWrite(LEFT_FWD, HIGH);
    digitalWrite(LEFT_REV, HIGH);
    analogWrite(LEFT_PWM, 0);
  }
}

void setRightMotor(int speed) {
  if (speed > 0) {
    digitalWrite(RIGHT_FWD, LOW);
    digitalWrite(RIGHT_REV, HIGH);
    analogWrite(RIGHT_PWM, speed);
  } else if (speed < 0) {
    digitalWrite(RIGHT_FWD, HIGH);
    digitalWrite(RIGHT_REV, LOW);
    analogWrite(RIGHT_PWM, -speed);
  } else {
    digitalWrite(RIGHT_FWD, HIGH);
    digitalWrite(RIGHT_REV, HIGH);
    analogWrite(RIGHT_PWM, 0);
  }
}

// Rover movement functions
void moveForward(int speed) {
  setLeftMotor(speed);
  setRightMotor(speed);
}

void moveBackward(int speed) {
  setLeftMotor(-speed);
  setRightMotor(-speed);
}

void turnLeft(int speed) {
  setLeftMotor(-speed / 2);
  setRightMotor(speed);
}

void turnRight(int speed) {
  setLeftMotor(speed);
  setRightMotor(-speed / 2);
}

void stopBothMotors() {
  setLeftMotor(0);
  setRightMotor(0);
}

void loop() {
  // Example: Move forward for 2 seconds
  moveForward(150);
  delay(2000);

  // Turn right
  turnRight(150);
  delay(1000);

  // Stop
  stopBothMotors();
  delay(1000);
}
```

---

### ZS-X11H Wiring Guide

#### Step-by-Step Wiring Instructions

**1. Power Connections (Do these LAST for safety):**

- Use 14-16 AWG wire for 20A current capacity
- Connect battery positive (+) to controller VCC terminal
- Connect battery negative (-) to controller GND terminal
- **Add 1000μF or larger capacitor** across VCC and GND near controller
- Install 20-30A fuse in positive wire near battery
- Double-check polarity before powering on!

**2. Motor Phase Wires (3 thick wires):**

- Connect motor Yellow wire → Controller U/MA terminal
- Connect motor Blue wire → Controller V/MB terminal
- Connect motor Green wire → Controller W/MC terminal
- Secure with screw terminals or solder and heat shrink
- _Note: Phase order can be swapped to reverse direction_

**3. Hall Sensor Wires (5 thin wires from motor):**

- Connect motor Red wire → Controller +5V (Pin 6)
- Connect motor Black wire → Controller GND (Pin 10)
- Connect motor Yellow wire → Controller Ha (Pin 7)
- Connect motor Green wire → Controller Hb (Pin 8)
- Connect motor Blue wire → Controller Hc (Pin 9)
- Use JST connector or solder to header pins

**4. Control Signals from Arduino:**

- Arduino Pin 9 (PWM) → Controller PWM pin (Pin 5)
- Arduino Pin 7 (Digital) → Controller FWD pin (Pin 2)
- Arduino Pin 8 (Digital) → Controller REV pin (Pin 3)
- Arduino GND → Controller GND (Pin 1)
- **IMPORTANT:** Ensure common ground between Arduino and controller!

**5. Optional Brake Control:**

- Arduino Pin 6 (Digital) → Controller BRK pin (Pin 4)
- Leave disconnected if not used (pulled low internally)

#### Detailed Wiring Diagram (ZS-X11H with Hoverboard Motor)

```
═══════════════════════════════════════════════════════════════
            ZS-X11H MOTOR CONTROLLER WIRING DIAGRAM
═══════════════════════════════════════════════════════════════

Battery (24V-48V LiPo/Li-ion)
    |
    +---[Fuse 30A]---+
                     |
                [1000μF Cap]
                     |
                     +---[ZS-X11H Controller]
                     |
                     |  Power Terminals:
                     |    VCC (+)  ← Battery Positive
                     |    GND (-)  ← Battery Negative
                     |
                     |  Motor Phase Terminals:
                     |    MA/U (Yellow) ← Motor Phase 1
                     |    MB/V (Blue)   ← Motor Phase 2
                     |    MC/W (Green)  ← Motor Phase 3
                     |
                     |  Control Header (10-pin):
                     |    Pin 1: GND    ← Arduino GND
                     |    Pin 2: FWD    ← Arduino Pin 7
                     |    Pin 3: REV    ← Arduino Pin 8
                     |    Pin 4: BRK    ← Arduino Pin 6 (optional)
                     |    Pin 5: PWM    ← Arduino Pin 9
                     |    Pin 6: +5V    (output to Hall sensors)
                     |    Pin 7: Ha     ← Motor Hall A (Yellow)
                     |    Pin 8: Hb     ← Motor Hall B (Green)
                     |    Pin 9: Hc     ← Motor Hall C (Blue)
                     |    Pin 10: GND   ← Motor Hall GND (Black)
                     |
                     |
                     ↓
              [Hoverboard Hub Motor]
                     |
                  8 wires total:
                  - 3 thick phase wires (Yellow, Blue, Green)
                  - 5 thin Hall wires (Red, Black, Yellow, Green, Blue)

Arduino Mega 2560
    Pin 9 (PWM)  ────────→ Controller PWM (Pin 5)
    Pin 7 (Digital) ─────→ Controller FWD (Pin 2)
    Pin 8 (Digital) ─────→ Controller REV (Pin 3)
    Pin 6 (Digital) ─────→ Controller BRK (Pin 4)
    GND ─────────────────→ Controller GND (Pin 1)

Common Ground: Battery GND ← → Arduino GND ← → Controller GND
```

---

#### Visual Connection Reference

**Controller View (Top Down):**

```
┌────────────────────────────────────────┐
│  ZS-X11H Brushless Motor Controller    │
│                                        │
│  [PWR LED]  [STATUS LED]               │
│                                        │
│  Screw Terminals (Power & Motor):     │
│  ┌───┬───┬───┬───┬───┐               │
│  │VCC│GND│ U │ V │ W │               │
│  └───┴───┴───┴───┴───┘               │
│   ↑   ↑   ↑   ↑   ↑                  │
│  Batt Batt Motor Phases               │
│                                        │
│  Control Header (10-pin):              │
│  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬──┐             │
│  │1│2│3│4│5│6│7│8│9│10│             │
│  └─┴─┴─┴─┴─┴─┴─┴─┴─┴──┘             │
│   G F R B P + H H H G                 │
│   N W V K W 5 a b c N                 │
│   D D V   M V     D                   │
│                                        │
│  [Jumper]  ← PWM/POT select           │
│                                        │
└────────────────────────────────────────┘
```

---

#### Common Wiring Mistakes to Avoid

| Mistake                         | Consequence                    | Solution                                     |
| ------------------------------- | ------------------------------ | -------------------------------------------- |
| **Reversed Power Polarity**     | Controller destroyed instantly | Double-check with multimeter before power-on |
| **No Common Ground**            | Erratic behavior, no control   | Connect all GND pins together                |
| **Wrong Hall Voltage**          | Motor jerks or won't start     | Must use 5V, not 3.3V!                       |
| **Thin Power Wires**            | Voltage drop, overheating      | Use 14-16 AWG for 20A                        |
| **Missing Capacitor**           | Noise, unstable operation      | Add 1000μF at controller power input         |
| **Crossed Phase Wires**         | Motor stutters or doesn't spin | Check U-V-W connections                      |
| **High-Speed Direction Change** | Controller damage              | Reduce speed below 50% first!                |

---

### Troubleshooting Guide

#### Motor Won't Start

**Check these in order:**

1. **Power LED Status:**
   - OFF: No power reaching controller → Check battery, fuse, connections
   - ON: Power good, proceed to next step

2. **Hall Sensor Connections:**
   - Verify all 5 Hall wires connected correctly
   - Check +5V on controller Pin 6 (should read 5V with multimeter)
   - Test Hall sensors: slowly rotate motor by hand, Ha/Hb/Hc should toggle

3. **Motor Phase Connections:**
   - Verify U, V, W connected to motor
   - Try swapping two phases to check for improvement

4. **Control Signals:**
   - PWM signal present? (should see voltage changing)
   - FWD or REV pin LOW? (one must be LOW for motor to run)
   - Check common ground between Arduino and controller

5. **Motor Compatibility:**
   - Confirm motor has Hall sensors (5-wire harness)
   - Verify motor is 120° electrical angle (most hoverboard motors are)

---

#### Motor Spins Erratically

**Possible Causes:**

| Symptom                    | Likely Cause             | Fix                                       |
| -------------------------- | ------------------------ | ----------------------------------------- |
| **Motor jerks/stutters**   | Hall sensor issue        | Check all 5 Hall wires, ensure 5V power   |
| **Motor runs then stops**  | Overcurrent protection   | Reduce load, check for mechanical binding |
| **Speed fluctuates**       | PWM signal issue         | Check PWM frequency (1 kHz recommended)   |
| **Wrong direction**        | Swap any two phase wires | Swap U-V or V-W or U-W                    |
| **No torque at low speed** | Normal for some motors   | Increase minimum PWM duty cycle (10-15%)  |

---

#### Direction Control Not Working

1. **Check FWD/REV Logic:**
   - FWD=LOW, REV=HIGH → Should go forward
   - FWD=HIGH, REV=LOW → Should go reverse
   - Both HIGH → Motor stopped

2. **Verify Connections:**
   - FWD pin connected to Arduino Pin 7
   - REV pin connected to Arduino Pin 8
   - Common ground present

3. **Test with Serial Monitor:**
   - Upload test sketch from examples above
   - Use 'f' and 'r' commands to test direction
   - Observe serial output for confirmation

---

### Performance Optimization Tips

**1. Smooth Acceleration/Deceleration:**

```cpp
void smoothSpeed(int targetSpeed) {
  static int currentSpeed = 0;
  int step = 5;  // Acceleration rate

  while (currentSpeed != targetSpeed) {
    if (currentSpeed < targetSpeed) {
      currentSpeed += step;
      if (currentSpeed > targetSpeed) currentSpeed = targetSpeed;
    } else {
      currentSpeed -= step;
      if (currentSpeed < targetSpeed) currentSpeed = targetSpeed;
    }
    analogWrite(MOTOR_PWM, currentSpeed);
    delay(20);  // 50 Hz update rate
  }
}
```

**2. Dead Zone Elimination:**

```cpp
int applyDeadZone(int speed) {
  const int minSpeed = 30;  // Minimum PWM for motor to turn
  if (speed == 0) return 0;
  if (abs(speed) < minSpeed) return (speed > 0) ? minSpeed : -minSpeed;
  return speed;
}
```

**3. Current Monitoring (if available):**

- Monitor battery current draw
- Implement soft current limiting
- Protect battery from over-discharge

---

### Recommended Accessories

**Essential:**

- **Capacitor:** 1000-2200μF, 63V+ electrolytic capacitor at controller power input
- **Fuse:** 20-30A automotive blade fuse or ANL fuse
- **Heat Shrink:** For all wire connections and strain relief
- **Wire:** 14-16 AWG silicone wire for power connections

**Recommended:**

- **XT60 Connectors:** For battery connections (60A rating)
- **Anderson Powerpole:** For modular power distribution
- **Heatsink:** Small aluminum heatsink for controller MOSFETs
- **LED Indicators:** External status LEDs for debugging
- **Emergency Stop Button:** Safety cutoff switch

**Optional:**

- **Current Sensor:** ACS712 or similar for current monitoring
- **Voltage Monitor:** To track battery state
- **Temperature Sensor:** Monitor controller temperature
- **Optical Encoder:** For precise speed control (if speed pulse output unavailable)

---

## Brushless Hub Motors

### Motor Specifications

Brushless hub motors, particularly those salvaged from hoverboards, are ideal for mobile robotics
due to their compact design, high torque, and integrated wheel design.

#### Typical Hub Motor Specifications

**Common Hoverboard Motor (6.5" - 10"):**

| Parameter         | Value                              |
| ----------------- | ---------------------------------- |
| **Rated Voltage** | 24V / 36V / 48V (nominal)          |
| **Rated Power**   | 250W - 350W per wheel              |
| **Peak Power**    | 500W - 700W (short duration)       |
| **Rated Speed**   | 300 - 500 RPM                      |
| **Max Speed**     | 600 - 800 RPM                      |
| **Rated Torque**  | 3.5 N⋅m - 5 N⋅m                    |
| **Peak Torque**   | 7 N⋅m - 10 N⋅m                     |
| **Rated Current** | 3A - 8A per motor                  |
| **Peak Current**  | 15A - 20A per motor                |
| **Efficiency**    | 83% - 90%                          |
| **Weight**        | 2.5 kg - 3.5 kg                    |
| **Max Load**      | 80 kg - 100 kg per wheel           |
| **Pole Pairs**    | 10 (typical for hoverboard motors) |

#### Physical Specifications

**Wheel Sizes:**

- 6.5 inch (165mm) - Most common
- 8 inch (200mm) - Larger hoverboards
- 10 inch (254mm) - Off-road versions

**Motor Design:**

- Type: Permanent magnet brushless DC (BLDC)
- Configuration: Outrunner (outer shell rotates)
- Stator: Fixed internal electromagnets
- Rotor: Permanent magnets on rotating outer shell
- Integration: Tire mounted directly to motor

**Tire Details:**

- Solid rubber (6.5", 8") or pneumatic (10")
- Tread pattern: Varies by model
- Diameter includes tire (outer diameter)

---

### Motor Wiring Configuration

Hoverboard hub motors typically have **8 wires** total:

- **3 thick wires:** Motor phases (power)
- **5 thin wires:** Hall effect sensors (feedback)

#### Phase Wire Connections

**Motor Phase Wires (Thick):**

| Wire Color | Function | Connection                       |
| ---------- | -------- | -------------------------------- |
| **Yellow** | Phase U  | Connect to controller U terminal |
| **Blue**   | Phase V  | Connect to controller V terminal |
| **Green**  | Phase W  | Connect to controller W terminal |

**Important Notes:**

- Wire colors may vary by manufacturer
- Phase order affects rotation direction
- Swapping any two phases reverses direction
- All three phases must be connected
- Don't connect phases to power directly!

**Phase Wire Specifications:**

- Gauge: Typically 18 AWG - 20 AWG
- Insulation: Heat-resistant silicone
- Resistance: ~0.5Ω lead-to-lead
- Can handle: 10-20A continuous

---

### Hall Sensor Details

Hall effect sensors provide real-time position feedback to the motor controller, enabling precise
speed and torque control.

#### Hall Sensor Wire Connections

**5-Wire Hall Sensor Cable (Thin):**

| Wire Color | Function     | Voltage | Connection                |
| ---------- | ------------ | ------- | ------------------------- |
| **Red**    | Power (+5V)  | 5V      | Connect to controller +5V |
| **Black**  | Ground (GND) | 0V      | Connect to controller GND |
| **Yellow** | Hall A (Ha)  | 0-5V    | Connect to controller Ha  |
| **Green**  | Hall B (Hb)  | 0-5V    | Connect to controller Hb  |
| **Blue**   | Hall C (Hc)  | 0-5V    | Connect to controller Hc  |

**Alternative Color Schemes:** Some motors use different colors:

- Red: +5V
- Black: GND
- White/Brown/Orange: Ha, Hb, Hc (varies)

#### Hall Sensor Technical Details

**Sensor Type:**

- Unipolar Hall effect switches
- Digital output (HIGH/LOW)
- Three sensors, 120° electrical spacing

**Electrical Characteristics:**

- Supply Voltage: 5V ± 0.5V (must be 5V, not 3.3V!)
- Output: Open collector or push-pull
- Output Voltage High: ~4.5V - 5V
- Output Voltage Low: 0V - 0.5V
- Switching Frequency: Up to 100 kHz
- Current Draw: ~10 mA per sensor

**Position Encoding:**

- 6 states per electrical cycle
- 60° electrical spacing between state changes
- 10 pole pairs = 60 states per mechanical revolution
- 90 counts per revolution (approximate)

**Hall Sensor State Table:**

| Position | Ha  | Hb  | Hc  | Phase Sequence |
| -------- | --- | --- | --- | -------------- |
| 0°       | 1   | 0   | 1   | State 1        |
| 60°      | 1   | 0   | 0   | State 2        |
| 120°     | 1   | 1   | 0   | State 3        |
| 180°     | 0   | 1   | 0   | State 4        |
| 240°     | 0   | 1   | 1   | State 5        |
| 300°     | 0   | 0   | 1   | State 6        |

#### Testing Hall Sensors

**Bench Test Procedure:**

1. Disconnect motor from controller
2. Connect +5V power supply to red wire
3. Connect GND to black wire
4. Connect multimeter between black (GND) and Ha (yellow)
5. Slowly rotate motor by hand
6. Voltage should cycle between 0V and 5V
7. Repeat for Hb and Hc

**Expected Behavior:**

- Each sensor should toggle HIGH/LOW
- Six state changes per electrical revolution
- All three sensors should work
- If one sensor is stuck, it may need replacement

**Common Hall Sensor Failures:**

- Stuck HIGH or LOW
- Intermittent connection
- Water damage
- Mechanical damage to sensor PCB inside motor

#### Hall Sensor Calibration

Most ESCs and motor controllers require Hall sensor calibration:

- Ensures proper commutation sequence
- Matches Hall states to motor phases
- Optimizes efficiency and smoothness

**Calibration Process (varies by controller):**

1. Connect all wires correctly
2. Enter calibration mode (button press or command)
3. Controller slowly rotates motor
4. Controller learns Hall sensor sequence
5. Save calibration parameters
6. Test motor operation

---

### ESC PWM Protocol

Electronic Speed Controllers (ESCs) for brushless motors typically use standard hobby RC PWM signals
for speed control.

#### Standard PWM Signal Specifications

**Signal Timing:**

| Parameter             | Value                        | Notes                      |
| --------------------- | ---------------------------- | -------------------------- |
| **Signal Type**       | PWM (Pulse Width Modulation) | Standard RC servo protocol |
| **Frequency**         | 50 Hz                        | One pulse every 20 ms      |
| **Pulse Width Range** | 1000 - 2000 μs               | 1 ms to 2 ms               |
| **Stop/Idle**         | 1000 μs (1.0 ms)             | Motor off                  |
| **Half Speed**        | 1500 μs (1.5 ms)             | 50% throttle               |
| **Full Speed**        | 2000 μs (2.0 ms)             | 100% throttle              |
| **Voltage Level**     | 3.3V - 5V                    | Logic level compatible     |

**Pulse Width to Speed Mapping:**

```
1000 μs (1.0 ms)  →  0% speed (motor off)
1100 μs (1.1 ms)  →  10% speed
1200 μs (1.2 ms)  →  20% speed
1300 μs (1.3 ms)  →  30% speed
1400 μs (1.4 ms)  →  40% speed
1500 μs (1.5 ms)  →  50% speed
1600 μs (1.6 ms)  →  60% speed
1700 μs (1.7 ms)  →  70% speed
1800 μs (1.8 ms)  →  80% speed
1900 μs (1.9 ms)  →  90% speed
2000 μs (2.0 ms)  →  100% speed (full throttle)
```

#### Modern ESC Protocols

For advanced applications, several high-speed digital protocols are available:

**Oneshot125:**

- 8x faster than standard PWM
- Pulse width: 125 - 250 μs
- Update rate: Up to 1 kHz

**Oneshot42:**

- ~24x faster than standard PWM
- Pulse width: 42 - 84 μs
- Update rate: Up to 2 kHz

**Multishot:**

- ~40x faster than standard PWM
- Pulse width: 5 - 25 μs
- Update rate: Up to 32 kHz

**DShot (Digital Shot):**

- Fully digital protocol
- No timing calibration needed
- 150 - 1200 speeds per packet
- Bidirectional communication (telemetry)
- CRC error checking
- Variants: DShot150, DShot300, DShot600, DShot1200

**DShot Advantages:**

- Immune to clock drift
- No calibration required
- Telemetry feedback (RPM, current, voltage, temperature)
- Superior noise immunity

#### Arduino ESC Control Example

**Standard 50 Hz PWM Control:**

```cpp
#include <Servo.h>

Servo leftESC;
Servo rightESC;

void setup() {
  leftESC.attach(9);   // Attach to pin 9
  rightESC.attach(10); // Attach to pin 10

  // Initialize ESCs (send idle signal)
  leftESC.writeMicroseconds(1000);
  rightESC.writeMicroseconds(1000);
  delay(2000);  // Wait for ESC initialization
}

void loop() {
  // Set speed (1000-2000 μs)
  int speed = 1500;  // Half speed
  leftESC.writeMicroseconds(speed);
  rightESC.writeMicroseconds(speed);
}

// Function to set motor speed (-100 to +100)
void setMotorSpeed(int motor, int speed) {
  // Clamp speed to valid range
  speed = constrain(speed, -100, 100);

  // Map to microseconds (1000-2000)
  int pulse = map(abs(speed), 0, 100, 1000, 2000);

  if (motor == 0) {  // Left motor
    if (speed >= 0) {
      leftESC.writeMicroseconds(pulse);
    } else {
      // Reverse: handle separately if ESC supports bidirectional
      leftESC.writeMicroseconds(1000 - (pulse - 1000));
    }
  } else {  // Right motor
    if (speed >= 0) {
      rightESC.writeMicroseconds(pulse);
    } else {
      rightESC.writeMicroseconds(1000 - (pulse - 1000));
    }
  }
}
```

#### ESC Initialization and Calibration

**ESC Arming Sequence:**

1. Power on ESC with motor connected
2. Send low throttle signal (1000 μs) for 2-5 seconds
3. ESC produces confirmation beeps (if equipped with beeper)
4. ESC is now armed and ready for control signals
5. Gradually increase throttle to start motor

**ESC Throttle Calibration:** Some ESCs require throttle range calibration:

1. Power off ESC
2. Set controller to full throttle (2000 μs)
3. Power on ESC
4. ESC beeps to confirm high point
5. Set controller to low throttle (1000 μs)
6. ESC beeps to confirm low point
7. Calibration complete

#### Motor Direction Control

**Changing Rotation Direction:**

- **Method 1:** Swap any two of the three motor phase wires
- **Method 2:** Use ESC with programmable direction
- **Method 3:** Reverse PWM signal logic (if supported)

**Bidirectional ESCs:**

- Some ESCs support forward and reverse
- Pulse width < 1500 μs: Reverse
- Pulse width = 1500 μs: Stop
- Pulse width > 1500 μs: Forward

---

## System Integration

### Power Distribution

#### Power Architecture

The OmniTrek Nexus rover uses a distributed power system with separate supplies for logic and motor
power.

**Power Domains:**

1. **Logic Power (5V):**
   - Arduino Mega 2560
   - NodeMCU ESP8266 (via onboard 3.3V regulator)
   - Sensors and peripherals

2. **Motor Power (12V-48V):**
   - Motor controllers
   - Hub motors
   - High-current power distribution

**Recommended Power Supply Configuration:**

```
Main Battery (24V-48V LiPo/Li-ion)
    |
    +----[Fuse 30A]----+----[Motor Controller 1]----[Motor 1]
    |                  |
    |                  +----[Motor Controller 2]----[Motor 2]
    |
    +----[DC-DC Buck Converter]----[12V Rail]
    |                                   |
    |                                   +----[Arduino Mega VIN]
    |                                   +----[NodeMCU VIN]
    |                                   +----[Sensors]
    |
   GND (Common Ground)
```

#### Battery Specifications

**Recommended Battery Types:**

**LiPo (Lithium Polymer):**

- Voltage: 6S (22.2V nominal, 25.2V fully charged)
- Capacity: 5000 mAh - 10000 mAh
- Discharge Rate: 25C - 50C
- Advantages: High discharge rate, lightweight
- Disadvantages: Requires careful charging, fire risk

**Li-ion (Lithium-ion):**

- Voltage: 7S-13S (24V-48V nominal)
- Capacity: 5000 mAh - 20000 mAh
- Discharge Rate: 10C - 30C
- Advantages: Safer, longer lifespan
- Disadvantages: Heavier, lower discharge rate

**Lead Acid (SLA):**

- Voltage: 24V or 48V
- Capacity: 7 Ah - 35 Ah
- Advantages: Very safe, inexpensive
- Disadvantages: Heavy, lower energy density

#### Power Calculations

**Motor Power Requirements:**

- 2x 350W hub motors = 700W total
- At 36V: 700W / 36V = 19.4A continuous
- Peak current: ~40A (short duration)

**Logic Power Requirements:**

- Arduino Mega: ~100 mA
- NodeMCU ESP8266: ~80 mA (average)
- Sensors: ~200 mA (estimated)
- Total: ~500 mA @ 12V = 6W

**Total System Power:**

- Motors: 700W
- Logic: 6W
- Total: ~706W
- Battery life estimate: (Battery Wh) / 706W

**Example with 36V 10Ah Battery:**

- Battery capacity: 36V × 10Ah = 360 Wh
- Runtime at full throttle: 360Wh / 706W ≈ 0.5 hours (30 minutes)
- Typical runtime: 1-2 hours (intermittent use)

#### Protection Circuits

**Essential Protection Components:**

1. **Main Fuse:**
   - Rating: 30A-40A
   - Type: Automotive blade fuse or ANL fuse
   - Location: Between battery and motor controllers

2. **Reverse Polarity Protection:**
   - Method 1: Fuse + Diode
   - Method 2: MOSFET circuit
   - Protects against battery connection mistakes

3. **Low Voltage Cutoff (LVC):**
   - Prevents over-discharge of battery
   - LiPo: 3.0V - 3.3V per cell
   - Li-ion: 2.5V - 3.0V per cell

4. **Overcurrent Protection:**
   - Built into most motor controllers
   - Add external circuit breaker for main power

5. **EMI Filtering:**
   - Ferrite beads on motor phase wires
   - Capacitors across power supply
   - Shielded cables for signal wires

---

### Communication Architecture

#### Data Flow Diagram

```
[User Browser]
      |
      | (HTTP/WebSocket)
      ↓
[NodeMCU ESP8266] ←→ [WiFi Router/Direct]
      |
      | (Serial UART)
      ↓
[Arduino Mega 2560]
      |
      +----→ [Motor Controller 1] ----→ [Motor 1]
      |
      +----→ [Motor Controller 2] ----→ [Motor 2]
      |
      +----→ [Sensors]
```

#### Communication Protocols

**1. WiFi (NodeMCU ↔ Browser):**

- Protocol: WebSocket for real-time bidirectional communication
- Fallback: HTTP/HTTPS for REST API
- Format: JSON for structured data
- Frequency: 10-50 Hz updates

**2. Serial UART (NodeMCU ↔ Arduino):**

- Baud Rate: 115200 bps (recommended)
- Data Bits: 8
- Parity: None
- Stop Bits: 1
- Protocol: Custom packet-based or JSON
- Voltage: 3.3V (NodeMCU) ↔ 5V (Arduino) - **Level shifting required!**

**3. PWM (Arduino ↔ Motor Controllers):**

- Frequency: 1 kHz - 50 Hz (depending on ESC)
- Duty Cycle: 0-100% for speed control
- Additional: Digital pins for direction (FWD/REV)

#### Level Shifting Between 3.3V and 5V

The NodeMCU ESP8266 operates at 3.3V logic levels, while the Arduino Mega operates at 5V. Direct
connection can damage the ESP8266.

**Safe Connection Methods:**

**Method 1: Voltage Divider (Arduino TX → NodeMCU RX):**

```
Arduino TX (5V) ----[1kΩ]----+----→ NodeMCU RX (3.3V max)
                              |
                            [2kΩ]
                              |
                             GND
```

Result: 5V × (2kΩ / 3kΩ) = 3.3V

**Method 2: Level Shifter IC (Bidirectional):**

- Use TXS0108E or similar bidirectional level shifter
- Supports multiple channels
- Automatic direction detection
- Recommended for reliability

**Method 3: NodeMCU TX → Arduino RX (No Level Shift Needed):**

- NodeMCU 3.3V output is high enough for Arduino 5V input
- Arduino input HIGH threshold: ~2.5V
- NodeMCU output HIGH: ~3.3V
- Direct connection is safe

**Recommended Wiring:**

```
NodeMCU TX (3.3V) ----→ Arduino RX (can accept 3.3V)
NodeMCU RX (3.3V) ←---- [Voltage Divider] ←---- Arduino TX (5V)
GND ←----------------------------------→ GND (common ground)
```

#### Serial Communication Protocol Example

**JSON-based Message Format:**

**Arduino → NodeMCU (Telemetry):**

```json
{
  "type": "telemetry",
  "timestamp": 123456,
  "motor1_speed": 75,
  "motor2_speed": 75,
  "battery_voltage": 36.5,
  "current_draw": 12.3,
  "temperature": 45
}
```

**NodeMCU → Arduino (Commands):**

```json
{
  "type": "command",
  "action": "move",
  "motor1": 80,
  "motor2": 70,
  "direction": "forward"
}
```

**Packet-based Binary Protocol (more efficient):**

```
Start Byte | Command | Data Length | Data Bytes | Checksum | End Byte
   0xAA    |   0x01  |     0x04    |  [4 bytes] |   0xXX   |   0x55
```

---

### Wiring Diagrams

#### Complete System Wiring

```
═══════════════════════════════════════════════════════════════
                    OmniTrek NEXUS WIRING DIAGRAM
═══════════════════════════════════════════════════════════════

Battery (36V)
    |
    +---[Fuse 30A]---+
                     |
                     +---[Motor Controller 1]
                     |       |   |   |
                     |       U   V   W
                     |       |   |   |
                     |      [Left Hub Motor]
                     |       |   |   |   |   |
                     |       Ha  Hb  Hc  +5V GND
                     |       |   |   |   |   |
                     |       +---+---+---+---+---- To Controller Hall Input
                     |
                     +---[Motor Controller 2]
                     |       |   |   |
                     |       U   V   W
                     |       |   |   |
                     |      [Right Hub Motor]
                     |       |   |   |   |   |
                     |       Ha  Hb  Hc  +5V GND
                     |       |   |   |   |   |
                     |       +---+---+---+---+---- To Controller Hall Input
                     |
                     +---[DC-DC Buck 36V→12V]
                             |
                             +---[Arduino Mega 2560 VIN]
                             |       |
                             |       +--- Digital Pin 9 → Motor Controller 1 PWM
                             |       +--- Digital Pin 10 → Motor Controller 2 PWM
                             |       +--- Digital Pin 7 → Motor Controller 1 FWD
                             |       +--- Digital Pin 8 → Motor Controller 1 REV
                             |       +--- Digital Pin 5 → Motor Controller 2 FWD
                             |       +--- Digital Pin 6 → Motor Controller 2 REV
                             |       |
                             |       +--- TX1 (Pin 18) → [Voltage Divider] → NodeMCU RX
                             |       +--- RX1 (Pin 19) ← NodeMCU TX
                             |       |
                             |      GND ← Common Ground
                             |
                             +---[NodeMCU ESP8266 VIN]
                                     |
                                     +--- WiFi Connection → User Browser
                                     |
                                    GND ← Common Ground

All Grounds Connected Together: Battery GND, Arduino GND, NodeMCU GND, Motor Controller GND
```

#### Motor Controller Detail Wiring

```
Motor Controller (RioRand 350W with Hall)
┌──────────────────────────────────────────────────┐
│                                                  │
│  VCC (+)  ←──────────────── Battery Positive    │
│  GND (-)  ←──────────────── Battery Negative    │
│                                                  │
│  U (Yellow) ←──────────────→ Motor Phase U      │
│  V (Green)  ←──────────────→ Motor Phase V      │
│  W (Blue)   ←──────────────→ Motor Phase W      │
│                                                  │
│  Ha (Yellow) ←──────────────→ Motor Hall A      │
│  Hb (Green)  ←──────────────→ Motor Hall B      │
│  Hc (Blue)   ←──────────────→ Motor Hall C      │
│  +5V (Red)   ←──────────────→ Motor Hall +5V    │
│  GND (Black) ←──────────────→ Motor Hall GND    │
│                                                  │
│  PWM  ←───────────────────── Arduino PWM Pin    │
│  FWD  ←───────────────────── Arduino Digital    │
│  REV  ←───────────────────── Arduino Digital    │
│  GND  ←───────────────────── Arduino GND        │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### Level Shifter Wiring (Arduino ↔ NodeMCU)

```
Arduino Mega                         NodeMCU ESP8266
    5V ──────────────┐   ┌────────────── 3.3V
                     │   │
                [Level Shifter]
                  TXS0108E
                     │   │
    TX1 (Pin 18) ────┼───┼──→ High→Low ──→ RX
    RX1 (Pin 19) ←───┼───┼──← Low→High ←── TX
                     │   │
    GND ─────────────┴───┴────────────── GND
```

---

## Technical Resources

### Official Datasheets

**Arduino Mega 2560:**

- [Arduino Mega 2560 Rev3 Official Datasheet](https://docs.arduino.cc/resources/datasheets/A000067-datasheet.pdf)
- [ATmega2560 Microcontroller Datasheet](https://ww1.microchip.com/downloads/en/devicedoc/atmel-2549-8-bit-avr-microcontroller-atmega640-1280-1281-2560-2561_datasheet.pdf)
- [Arduino Mega 2560 Documentation](https://docs.arduino.cc/hardware/mega-2560)

**NodeMCU ESP8266:**

- [ESP8266EX Datasheet](https://www.espressif.com/sites/default/files/documentation/0a-esp8266ex_datasheet_en.pdf)
- [ESP8266 Technical Reference Manual](https://www.espressif.com/sites/default/files/documentation/esp8266-technical_reference_en.pdf)
- [ESP8266 Product Page](https://www.espressif.com/en/products/socs/esp8266)

**RioRand Motor Controllers:**

- [RioRand 300W 5-50V User Manual](https://manuals.plus/asin/B087M3GVYX)
- [RioRand 7-70V 30A User Manual](https://manuals.plus/uncategorized/riorand-7-70v-pwm-dc-30a-motor-speed-controller-switch-user-manual)

**Brushless Motors:**

- [ODrive Hoverboard Motor Guide](https://docs.odriverobotics.com/v/0.5.4/hoverboard.html)
- [Understanding BLDC Motor Control](https://www.microchip.com/en-us/application-notes/an857)

### Recommended Tools

**Hardware Tools:**

- Multimeter (for voltage, current, continuity testing)
- Oscilloscope (for PWM signal verification)
- Logic analyzer (for digital protocol debugging)
- Soldering iron and heat shrink tubing
- Wire strippers and crimpers
- Hot glue gun (for strain relief)

**Software Tools:**

- Arduino IDE (version 2.x or later)
- PlatformIO (advanced development)
- Serial monitor (Arduino IDE, PuTTY, screen)
- ESP8266 Flashing Tool
- ODrive Configuration Tool (if using ODrive controllers)

### Pinout Diagrams

**Arduino Mega 2560 Pinout:**

- High-resolution PDF:
  [https://docs.arduino.cc/static/2b141eb1cfe6f465a949c203d4af1b5f/A000067-full-pinout.pdf](https://docs.arduino.cc/static/2b141eb1cfe6f465a949c203d4af1b5f/A000067-full-pinout.pdf)

**NodeMCU ESP8266 Pinout:**

- Detailed reference:
  [https://randomnerdtutorials.com/esp8266-pinout-reference-gpios/](https://randomnerdtutorials.com/esp8266-pinout-reference-gpios/)

**ESP8266 GPIO Reference:**

- [https://lastminuteengineers.com/esp8266-pinout-reference/](https://lastminuteengineers.com/esp8266-pinout-reference/)

### Online Communities and Forums

- Arduino Forum: [https://forum.arduino.cc/](https://forum.arduino.cc/)
- ESP8266 Community: [https://www.esp8266.com/](https://www.esp8266.com/)
- Reddit /r/arduino: [https://www.reddit.com/r/arduino/](https://www.reddit.com/r/arduino/)
- Reddit /r/esp8266: [https://www.reddit.com/r/esp8266/](https://www.reddit.com/r/esp8266/)

---

## Appendices

### Appendix A: Glossary

**ADC (Analog-to-Digital Converter):** Converts analog voltage to digital value for microcontroller
processing.

**BLDC (Brushless DC Motor):** Electric motor with electronic commutation instead of mechanical
brushes.

**Bootloader:** Small program that allows microcontroller to be programmed via serial/USB.

**Commutation:** Process of switching motor phases to generate rotation in brushless motors.

**Cogging:** Torque ripple in motors due to magnetic attraction between rotor and stator.

**Duty Cycle:** Percentage of time a PWM signal is HIGH (0-100%).

**ESC (Electronic Speed Controller):** Device that controls speed and direction of electric motors.

**GPIO (General Purpose Input/Output):** Pin that can be programmed as either input or output.

**Hall Effect Sensor:** Sensor that detects magnetic fields, used for motor position feedback.

**I2C (Inter-Integrated Circuit):** Two-wire serial communication protocol (SDA, SCL).

**ISP (In-System Programming):** Method of programming microcontroller without removing from
circuit.

**LiPo (Lithium Polymer):** Rechargeable battery type with high energy density.

**PCB (Printed Circuit Board):** Board with conductive traces for electrical connections.

**PWM (Pulse Width Modulation):** Method of controlling power by rapidly switching on/off.

**RISC (Reduced Instruction Set Computer):** CPU architecture with simple, fast instructions.

**SPI (Serial Peripheral Interface):** Four-wire synchronous serial communication protocol.

**UART (Universal Asynchronous Receiver/Transmitter):** Hardware circuit for serial communication.

### Appendix B: Wire Gauge Selection

**American Wire Gauge (AWG) Current Ratings:**

| AWG | Diameter (mm) | Ampacity (Chassis Wiring) | Ampacity (Power Transmission) |
| --- | ------------- | ------------------------- | ----------------------------- |
| 22  | 0.644         | 7A                        | 0.92A                         |
| 20  | 0.812         | 11A                       | 1.5A                          |
| 18  | 1.024         | 16A                       | 2.3A                          |
| 16  | 1.291         | 22A                       | 3.7A                          |
| 14  | 1.628         | 32A                       | 5.9A                          |
| 12  | 2.053         | 41A                       | 9.3A                          |
| 10  | 2.588         | 55A                       | 15A                           |

**Recommended Wire Gauge for OmniTrek:**

- Motor phases (U, V, W): 16 AWG or thicker
- Battery to controller: 14 AWG or thicker
- Hall sensor wires: 22-24 AWG (low current)
- Control signals: 24-26 AWG (very low current)
- Power supply to Arduino: 18-20 AWG

### Appendix C: Connector Types

**Common Connectors Used:**

**Power Connectors:**

- **XT60:** 60A continuous, common for battery connections
- **XT90:** 90A continuous, heavy-duty battery connections
- **Anderson Powerpole:** Modular, genderless, 15-45A
- **Bullet Connectors:** 3.5mm, 4mm, 5mm for motor phases
- **Barrel Jack:** 2.1mm or 2.5mm for Arduino power

**Signal Connectors:**

- **JST-XH:** Small pitch (2.5mm), common for hobby electronics
- **JST-PH:** Micro (2.0mm pitch), very compact
- **Dupont:** 0.1" (2.54mm) pitch, standard for Arduino
- **Micro USB:** Programming NodeMCU
- **USB Type B:** Programming Arduino Mega

### Appendix D: Color Code Standards

**Resistor Color Code:**

- Black: 0, Brown: 1, Red: 2, Orange: 3, Yellow: 4
- Green: 5, Blue: 6, Violet: 7, Gray: 8, White: 9

**Wire Color Conventions:**

- **Red:** Positive power
- **Black:** Ground/Negative
- **Yellow, Green, Blue:** Motor phases or Hall sensors
- **White:** Neutral or signal
- **Orange:** Signal or secondary power

**LED Indicators:**

- **Red:** Error or power
- **Green:** OK or activity
- **Blue:** Communication active
- **Yellow/Amber:** Warning or standby

### Appendix E: Safety Guidelines

**Electrical Safety:**

1. Always disconnect power before wiring
2. Double-check polarity before connecting battery
3. Use appropriate fuse ratings
4. Insulate all exposed connections
5. Avoid short circuits with proper wire routing
6. Use heat shrink tubing on all solder joints

**Battery Safety:**

1. Never short circuit battery terminals
2. Store LiPo batteries at storage charge (3.8V/cell)
3. Use fireproof charging bags
4. Dispose of damaged batteries properly
5. Monitor battery temperature during use
6. Use proper charger with balance charging

**Motor Safety:**

1. Secure motors to prevent movement during testing
2. Keep hands away from rotating parts
3. Use emergency stop button
4. Start at low speeds during testing
5. Monitor motor temperature
6. Check for loose wires before operation

**Workspace Safety:**

1. Well-ventilated area for soldering
2. Fire extinguisher nearby
3. First aid kit available
4. Safety glasses when soldering or cutting
5. ESD protection for sensitive components

### Appendix F: Troubleshooting Quick Reference

**Motor Won't Start:**

- Check power connections and polarity
- Verify Hall sensor connections (5V, not 3.3V!)
- Test PWM signal with oscilloscope
- Check ESC calibration
- Verify phase wire connections

**Erratic Motor Behavior:**

- Check for loose connections
- Verify common ground between all systems
- Add EMI filtering capacitors
- Shorten phase wires
- Check for damaged Hall sensors

**Communication Errors:**

- Verify baud rate matches on both devices
- Check TX/RX not swapped
- Ensure common ground connection
- Use level shifter for 3.3V ↔ 5V
- Check for electrical noise on serial lines

**NodeMCU Won't Connect to WiFi:**

- Verify correct SSID and password
- Check 2.4 GHz frequency (not 5 GHz)
- Ensure router channel is 1-11
- Check for interference
- Verify antenna not damaged

**Arduino Upload Fails:**

- Check USB cable (must support data, not just power)
- Select correct board and port in IDE
- Try pressing reset before upload
- Check for Serial monitor open (close it)
- Verify drivers installed for CH340 or FTDI

---

## Document Revision History

| Version | Date       | Author             | Changes                                                                                                                                                                                                                                                                                      |
| ------- | ---------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2025-10-28 | Claude (Anthropic) | Initial comprehensive documentation                                                                                                                                                                                                                                                          |
| 2.0     | 2025-10-28 | Claude (Anthropic) | Updated to focus exclusively on ZS-X11H motor controller. Removed other controller variants. Added detailed ZS-X11H pinout, control modes, complete Arduino examples, troubleshooting guide, and performance optimization tips. Enhanced with practical wiring diagrams and safety warnings. |

---

## License and Disclaimer

**Document License:** This documentation is provided for the OmniTrek Nexus project. You may use,
modify, and distribute this document for educational and non-commercial purposes.

**Disclaimer:** This documentation is provided "as is" without warranty of any kind. The authors are
not responsible for any damage to hardware, injury, or other consequences resulting from use of this
information. Always follow manufacturer datasheets and safety guidelines.

**Safety Notice:** Working with electricity, batteries, and motors can be dangerous. If you are not
experienced with electronics, seek guidance from a qualified individual. Always prioritize safety.

---

**END OF DOCUMENT**

Total Pages: ~50 (estimated when printed) Total Word Count: ~12,000+ Total Specifications: 200+
detailed parameters Total Diagrams: 10+ ASCII wiring diagrams Total Tables: 50+ specification tables
