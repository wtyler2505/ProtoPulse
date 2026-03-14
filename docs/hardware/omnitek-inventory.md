# OmniTrek Hardware Inventory

> **Last Updated**: 2025-10-12
> **Project**: OmniTrek Rover Platform
> **Status**: Hardware Integration Phase
> **Safety Certification**: ⚠️ PENDING VALIDATION

## Overview

This document tracks all hardware components for the OmniTrek rover platform, including core electronics, power systems, motor controllers, and critical safety equipment. All components must pass safety validation before operational use.

---

## 1. Core Control Components

### 1.1 Primary Controller: Arduino Mega 2560

- [ ] **Component Present**: Arduino Mega 2560 Rev3
- [ ] **Serial Number**: _________________
- [ ] **Firmware Version**: _________________
- [ ] **USB Connection Verified**: (Date: _________)
- [ ] **Pin Functionality Test**: PASS / FAIL / PENDING
- [ ] **Power Supply Test (5V/3.3V rails)**: PASS / FAIL / PENDING
- [ ] **Clock Speed Verified (16MHz)**: PASS / FAIL / PENDING

**Specifications**:
- Microcontroller: ATmega2560
- Operating Voltage: 5V
- Digital I/O Pins: 54 (15 PWM outputs)
- Analog Input Pins: 16
- Flash Memory: 256 KB
- SRAM: 8 KB
- EEPROM: 4 KB

**Test Results**:
```
Date         | Test Type              | Result | Notes
-------------|------------------------|--------|---------------------------
             | USB Communication      |        |
             | PWM Output Stability   |        |
             | Analog Read Accuracy   |        |
             | I2C Bus Functionality  |        |
             | Serial Loopback        |        |
```

**Documentation Reference**: `/home/wtyler/RoverShit/OmniTrek/Arduino%20Mega%202560%20Documentation.pdf.pdf`

---

### 1.2 Wireless Controller: ESP8266 NodeMCU Amica

- [ ] **Component Present**: NodeMCU Amica (ESP8266)
- [ ] **MAC Address**: _________________
- [ ] **Firmware Version**: _________________
- [ ] **WiFi Range Test**: _________m (tested)
- [ ] **AP Mode Verified**: PASS / FAIL / PENDING
- [ ] **Station Mode Verified**: PASS / FAIL / PENDING
- [ ] **HTTP Server Test**: PASS / FAIL / PENDING
- [ ] **WebSocket Test**: PASS / FAIL / PENDING

**Specifications**:
- SoC: ESP8266 (ESP-12E module)
- Operating Voltage: 3.3V
- Flash Memory: 4MB
- WiFi: 802.11 b/g/n (2.4 GHz)
- Digital I/O Pins: 11 (all PWM capable)
- Analog Input: 1 (10-bit ADC)

**Network Configuration**:
```
SSID (AP Mode):      _________________
Password:            _________________
IP Address (AP):     192.168.4.1 (default)
IP Address (Station): _________________
Signal Strength:     _________ dBm
```

**Test Results**:
```
Date         | Test Type              | Result | Notes
-------------|------------------------|--------|---------------------------
             | WiFi Connection        |        |
             | HTTP Request Response  |        |
             | WebSocket Latency      |        |
             | Range Test (outdoor)   |        |
             | Interference Test      |        |
```

**Documentation Reference**: `/home/wtyler/RoverShit/OmniTrek/NodeMCU%20Amica%20(ESP8266)%20Documentation.pdf.pdf`

---

## 2. Motor & Drive System

### 2.1 Hoverboard Hub Motors (2x)

- [ ] **Motor 1 Present**: Brushless DC Hub Motor
  - [ ] **Serial/ID Number**: _________________
  - [ ] **Hall Sensor Test**: PASS / FAIL / PENDING
  - [ ] **Phase Resistance**: _________ Ω
  - [ ] **Bearing Condition**: GOOD / WORN / DAMAGED
  - [ ] **Wheel Mounting**: SECURE / LOOSE / NEEDS REPAIR

- [ ] **Motor 2 Present**: Brushless DC Hub Motor
  - [ ] **Serial/ID Number**: _________________
  - [ ] **Hall Sensor Test**: PASS / FAIL / PENDING
  - [ ] **Phase Resistance**: _________ Ω
  - [ ] **Bearing Condition**: GOOD / WORN / DAMAGED
  - [ ] **Wheel Mounting**: SECURE / LOOSE / NEEDS REPAIR

**Specifications (Each Motor)**:
- Type: Brushless DC (BLDC) with integrated hub
- Rated Voltage: 36V nominal
- Rated Power: 250-350W (estimated from hoverboard specs)
- Max Current: ~15A peak
- Wheel Diameter: ~6.5 inches (165mm)
- Hall Effect Sensors: 3-phase position feedback

**Performance Tests**:
```
Date         | Motor | Test Type           | Result | Notes
-------------|-------|---------------------|--------|---------------------------
             | M1    | No-Load Spin        |        |
             | M1    | Load Test (5kg)     |        |
             | M1    | Thermal (30min run) |        |
             | M2    | No-Load Spin        |        |
             | M2    | Load Test (5kg)     |        |
             | M2    | Thermal (30min run) |        |
```

**Documentation Reference**: `/home/wtyler/RoverShit/OmniTrek/Hoverboard%20Brushless%20Hub%20Motor%20Documentation.pdf.pdf`

---

### 2.2 Motor Controller: RioRand ZS-Z11H

- [ ] **Component Present**: RioRand High-Voltage Motor Controller
- [ ] **Model Number**: ZS-Z11H
- [ ] **Serial Number**: _________________
- [ ] **Firmware Version**: _________________
- [ ] **Voltage Range Test**: PASS / FAIL / PENDING
- [ ] **Current Limiting Verified**: PASS / FAIL / PENDING
- [ ] **PWM Input Response**: PASS / FAIL / PENDING
- [ ] **Thermal Protection Test**: PASS / FAIL / PENDING

**Specifications**:
- Input Voltage Range: 10-60V DC
- Continuous Current: 25A (per channel)
- Peak Current: 30A
- PWM Frequency: 16 kHz
- Control Interface: PWM (50Hz-20kHz)
- Thermal Shutdown: Yes (built-in)
- Overcurrent Protection: Yes

**Wiring Configuration**:
```
Power Input:   +______V (measured), GND
Motor 1 Out:   Phase A, Phase B, Phase C
Motor 2 Out:   Phase A, Phase B, Phase C
Control In:    PWM1 (Motor 1), PWM2 (Motor 2), GND
Enable:        EN1, EN2 (active high)
```

**Test Results**:
```
Date         | Test Type              | Result | Notes
-------------|------------------------|--------|---------------------------
             | Voltage Range (12V)    |        |
             | Voltage Range (24V)    |        |
             | Voltage Range (36V)    |        |
             | Current Limit (25A)    |        |
             | PWM Response (1ms)     |        |
             | Thermal Cutoff Test    |        |
```

**Documentation Reference**: `/home/wtyler/RoverShit/OmniTrek/RioRand%20High%20Voltage%20Motor%20Controller%20Documentation.pdf.pdf`

---

## 3. Power System

### 3.1 Main Battery Pack

- [ ] **Battery Present**: Hoverboard Lithium-Ion Pack
- [ ] **Serial Number**: _________________
- [ ] **Cell Configuration**: _______S _______P (e.g., 10S2P)
- [ ] **Nominal Voltage**: _______V
- [ ] **Measured Voltage**: _______V (date: _______)
- [ ] **Rated Capacity**: _______Ah
- [ ] **BMS Present**: YES / NO
- [ ] **BMS Balance Test**: PASS / FAIL / PENDING
- [ ] **Cell Voltage Balance**: PASS / FAIL / PENDING (max delta: _______mV)
- [ ] **Charge Cycle Count**: _________ cycles
- [ ] **Capacity Test**: _______% of rated (date: _______)

**Cell Voltages (Individual)**:
```
Cell #  | Voltage (V) | Status | Notes
--------|-------------|--------|---------------------------
Cell 1  |             |        |
Cell 2  |             |        |
Cell 3  |             |        |
Cell 4  |             |        |
Cell 5  |             |        |
Cell 6  |             |        |
Cell 7  |             |        |
Cell 8  |             |        |
Cell 9  |             |        |
Cell 10 |             |        |
```

**Safety Features**:
- [ ] **Over-Voltage Protection**: VERIFIED / NOT TESTED
- [ ] **Under-Voltage Protection**: VERIFIED / NOT TESTED
- [ ] **Over-Current Protection**: VERIFIED / NOT TESTED
- [ ] **Over-Temperature Protection**: VERIFIED / NOT TESTED
- [ ] **Short-Circuit Protection**: VERIFIED / NOT TESTED
- [ ] **Balance Charging**: VERIFIED / NOT TESTED

**Test Results**:
```
Date         | Test Type              | Result | Notes
-------------|------------------------|--------|---------------------------
             | Open-Circuit Voltage   |        |
             | Load Test (5A)         |        |
             | Load Test (15A)        |        |
             | Charge Test (2A)       |        |
             | BMS Balance Check      |        |
             | Thermal Test (30min)   |        |
```

**Documentation Reference**: `/home/wtyler/RoverShit/OmniTrek/Hoverboard%20Batteries%20Documentation.pdf.pdf`

---

### 3.2 Buck Converters: LM2596 Modules

#### 3.2.1 Buck Converter #1 (Controller Power)

- [ ] **Module Present**: LM2596 Step-Down
- [ ] **Input Voltage Range**: _______V to _______V
- [ ] **Output Voltage Set**: _______V (for controllers)
- [ ] **Output Current Rating**: _______A
- [ ] **Efficiency Test**: _______% (at rated load)
- [ ] **Ripple Voltage**: _______mV p-p
- [ ] **Thermal Performance**: PASS / FAIL / PENDING

**Configuration**:
```
Input:   Battery Main (________V)
Output:  5V @ _______A max (Arduino, sensors)
```

#### 3.2.2 Buck Converter #2 (Auxiliary Power)

- [ ] **Module Present**: LM2596 Step-Down
- [ ] **Input Voltage Range**: _______V to _______V
- [ ] **Output Voltage Set**: _______V (for ESP8266)
- [ ] **Output Current Rating**: _______A
- [ ] **Efficiency Test**: _______% (at rated load)
- [ ] **Ripple Voltage**: _______mV p-p
- [ ] **Thermal Performance**: PASS / FAIL / PENDING

**Configuration**:
```
Input:   Battery Main (________V)
Output:  3.3V @ _______A max (ESP8266, peripherals)
```

**Test Results**:
```
Date         | Module | Test Type           | Result | Notes
-------------|--------|---------------------|--------|---------------------------
             | Buck#1 | Line Regulation     |        |
             | Buck#1 | Load Regulation     |        |
             | Buck#1 | Efficiency (50% ld) |        |
             | Buck#2 | Line Regulation     |        |
             | Buck#2 | Load Regulation     |        |
             | Buck#2 | Efficiency (50% ld) |        |
```

**Documentation Reference**: `/home/wtyler/RoverShit/OmniTrek/LM2596%20DC-DC%20Step-Down%20Buck%20Converter%20Documentation.pdf.pdf`

---

## 4. Safety Equipment (CRITICAL)

> ⚠️ **ALL SAFETY SYSTEMS MUST BE TESTED AND VERIFIED BEFORE OPERATIONAL USE**

### 4.1 Hardware Emergency Stop

- [ ] **Physical E-Stop Present**: YES / NO
- [ ] **E-Stop Type**: _________________ (button, relay, contactor)
- [ ] **Battery Disconnect Method**: MECHANICAL / RELAY / CONTACTOR
- [ ] **Response Time**: _______ms (measured)
- [ ] **Failsafe Mode**: NORMALLY_OPEN / NORMALLY_CLOSED
- [ ] **Redundancy**: SINGLE / DUAL / TRIPLE
- [ ] **Manual Reset Required**: YES / NO
- [ ] **Visual Indicator**: LED / NONE
- [ ] **Audible Indicator**: BUZZER / NONE

**Wiring Configuration**:
```
Battery (+) → E-Stop → Main Power Rail
E-Stop Signal → Arduino Pin _____ (input pullup)
Status LED → Pin _____ (visual feedback)
```

**Test Results**:
```
Date         | Test Type              | Result | Notes
-------------|------------------------|--------|---------------------------
             | Response Time Test     |        |
             | Failsafe Verification  |        |
             | 100-Cycle Durability   |        |
             | High-Current Cutoff    |        |
             | Reset Functionality    |        |
```

**Acceptance Criteria**:
- Response time < 50ms
- Failsafe mode = Normally Open (motors stop on failure)
- 1000+ cycle reliability verified
- Current interrupt capability ≥ 30A continuous

---

### 4.2 Current Limiting Circuits

- [ ] **Current Sensor #1**: Type: _________, Rating: _______A
  - [ ] **Calibration Date**: _____________
  - [ ] **Accuracy**: ±_______%
  - [ ] **Arduino Input Pin**: _______
  - [ ] **Alert Threshold**: _______A (software)
  - [ ] **Hardware Cutoff**: _______A (if present)

- [ ] **Current Sensor #2**: Type: _________, Rating: _______A
  - [ ] **Calibration Date**: _____________
  - [ ] **Accuracy**: ±_______%
  - [ ] **Arduino Input Pin**: _______
  - [ ] **Alert Threshold**: _______A (software)
  - [ ] **Hardware Cutoff**: _______A (if present)

**Protection Values**:
```
Component        | Rated | Warning | Cutoff | Action
-----------------|-------|---------|--------|---------------------------
Motor 1          | 15A   | 18A     | 20A    | PWM reduce / stop
Motor 2          | 15A   | 18A     | 20A    | PWM reduce / stop
Total System     | 30A   | 35A     | 40A    | Emergency stop
Controller (5V)  | 2A    | 2.5A    | 3A     | Shutdown non-critical
Controller (3.3V)| 1A    | 1.2A    | 1.5A   | Shutdown non-critical
```

**Test Results**:
```
Date         | Sensor | Test Type           | Result | Notes
-------------|--------|---------------------|--------|---------------------------
             | CS#1   | Calibration Check   |        |
             | CS#1   | Warning Trigger     |        |
             | CS#1   | Cutoff Trigger      |        |
             | CS#2   | Calibration Check   |        |
             | CS#2   | Warning Trigger     |        |
             | CS#2   | Cutoff Trigger      |        |
```

---

### 4.3 Thermal Monitoring

- [ ] **Temperature Sensor #1**: Type: _________, Location: _________
  - [ ] **Calibration Date**: _____________
  - [ ] **Accuracy**: ±_______°C
  - [ ] **Arduino Input Pin**: _______
  - [ ] **Warning Threshold**: _______°C
  - [ ] **Shutdown Threshold**: _______°C

- [ ] **Temperature Sensor #2**: Type: _________, Location: _________
  - [ ] **Calibration Date**: _____________
  - [ ] **Accuracy**: ±_______°C
  - [ ] **Arduino Input Pin**: _______
  - [ ] **Warning Threshold**: _______°C
  - [ ] **Shutdown Threshold**: _______°C

- [ ] **Temperature Sensor #3**: Type: _________, Location: _________
  - [ ] **Calibration Date**: _____________
  - [ ] **Accuracy**: ±_______°C
  - [ ] **Arduino Input Pin**: _______
  - [ ] **Warning Threshold**: _______°C
  - [ ] **Shutdown Threshold**: _______°C

**Thermal Limits**:
```
Component        | Normal | Warning | Shutdown | Action
-----------------|--------|---------|----------|---------------------------
Motor 1          | <60°C  | 70°C    | 80°C     | Reduce load / stop
Motor 2          | <60°C  | 70°C    | 80°C     | Reduce load / stop
Motor Controller | <50°C  | 60°C    | 70°C     | Reduce PWM / stop
Battery Pack     | <45°C  | 50°C    | 55°C     | Emergency stop
Buck Converter#1 | <60°C  | 70°C    | 80°C     | Load reduction
Buck Converter#2 | <60°C  | 70°C    | 80°C     | Load reduction
```

**Test Results**:
```
Date         | Sensor | Test Type           | Result | Notes
-------------|--------|---------------------|--------|---------------------------
             | TS#1   | Calibration Check   |        |
             | TS#1   | Warning Trigger     |        |
             | TS#1   | Shutdown Trigger    |        |
             | TS#2   | Calibration Check   |        |
             | TS#2   | Warning Trigger     |        |
             | TS#2   | Shutdown Trigger    |        |
             | TS#3   | Calibration Check   |        |
             | TS#3   | Warning Trigger     |        |
             | TS#3   | Shutdown Trigger    |        |
```

---

## 5. Structural Components

### 5.1 Frame: Salvaged Hoverboard Metal Frame

- [ ] **Frame Present**: YES / NO
- [ ] **Material**: _________ (aluminum, steel, etc.)
- [ ] **Weight**: _______kg
- [ ] **Load Capacity Test**: _______kg (tested)
- [ ] **Weld Integrity**: PASS / FAIL / PENDING
- [ ] **Mounting Points Secure**: PASS / FAIL / PENDING
- [ ] **Corrosion Status**: NONE / MINOR / MAJOR

**Modifications**:
```
Date         | Modification           | Purpose | Status
-------------|------------------------|---------|---------------------------
             |                        |         |
             |                        |         |
             |                        |         |
```

**Documentation Reference**: `/home/wtyler/RoverShit/OmniTrek/Salvaged%20Hoverboard%20Metal%20Frame%20Documentation.pdf.pdf`

---

## 6. Peripheral & Sensor Systems

### 6.1 Sensors (Future/Optional)

- [ ] **Ultrasonic Distance Sensor**: Type: _________, Qty: _______
- [ ] **IMU (Accelerometer/Gyro)**: Type: _________, Qty: _______
- [ ] **GPS Module**: Type: _________, Qty: _______
- [ ] **Wheel Encoders**: Type: _________, Qty: _______
- [ ] **Voltage Monitors**: Type: _________, Qty: _______
- [ ] **Current Monitors**: Type: _________, Qty: _______

---

## 7. Integration & System Tests

### 7.1 Complete System Integration Checklist

- [ ] **All Components Mounted**: Secure physical installation
- [ ] **All Wiring Complete**: High-power and low-power systems
- [ ] **All Connections Verified**: Continuity and polarity checks
- [ ] **Ground Loop Prevention**: Star grounding implemented
- [ ] **Wire Management**: Strain relief and cable routing
- [ ] **Insulation Verified**: No exposed high-voltage conductors
- [ ] **Fuse Protection**: Appropriate ratings installed

### 7.2 Safety System Integration Tests

- [ ] **E-Stop Functionality**: Emergency stop kills all power
- [ ] **Current Limiting**: Overload protection triggers correctly
- [ ] **Thermal Protection**: Temperature shutdown works
- [ ] **Voltage Monitoring**: Under/over-voltage protection
- [ ] **Failsafe Mode**: System defaults to safe state on failure
- [ ] **Manual Override**: Physical disconnects accessible

### 7.3 Operational Tests

```
Date         | Test Type              | Result | Notes
-------------|------------------------|--------|---------------------------
             | Static Power-Up        |        | No load, verify voltages
             | Controller Boot        |        | Arduino + ESP8266 startup
             | Motor Spin (no load)   |        | Both motors, low speed
             | Motor Load (5kg)       |        | Both motors, 50% throttle
             | WiFi Range Test        |        | Control distance limits
             | Battery Endurance      |        | Runtime at 50% throttle
             | Emergency Stop (live)  |        | Stop under load
             | Thermal Soak (30min)   |        | All components monitored
```

---

## 8. Maintenance & Calibration Schedule

### 8.1 Monthly Checks

- [ ] **Battery Voltage Balance**: Check cell voltages, record max delta
- [ ] **Motor Bearing Inspection**: Check for play or grinding
- [ ] **Wire Connection Torque**: Verify all terminals tight
- [ ] **E-Stop Function Test**: Verify emergency stop works
- [ ] **Current Sensor Calibration**: Verify accuracy with known load
- [ ] **Temperature Sensor Check**: Verify readings with IR thermometer

### 8.2 Quarterly Maintenance

- [ ] **Deep Component Inspection**: Visual inspection of all electronics
- [ ] **Battery Capacity Test**: Full discharge/charge cycle test
- [ ] **Motor Performance Test**: No-load speed, load torque
- [ ] **Thermal System Test**: Full-load 1-hour run, monitor temps
- [ ] **Safety System Audit**: Verify all protection systems functional

### 8.3 Annual Recertification

- [ ] **Complete Safety Re-Test**: All safety systems re-verified
- [ ] **Battery Health Assessment**: Internal resistance, capacity fade
- [ ] **Controller Firmware Update**: Check for updates, apply if needed
- [ ] **Structural Integrity**: Frame welds, mounting points inspection
- [ ] **Documentation Update**: This inventory updated with all changes

---

## 9. Procurement & Sourcing Information

### 9.1 Component Sources

```
Component             | Supplier           | Part Number    | Date Acquired
----------------------|--------------------|----------------|------------------
Arduino Mega 2560     |                    |                |
ESP8266 NodeMCU       |                    |                |
Hoverboard Motors     | Salvaged           | N/A            |
Motor Controller      |                    |                |
Battery Pack          | Salvaged           | N/A            |
LM2596 Buck Conv.     |                    |                |
Frame                 | Salvaged           | N/A            |
```

### 9.2 Spare Parts Inventory

- [ ] **Spare Fuses**: Qty: _______, Ratings: _____________
- [ ] **Spare Connectors**: Type: _________, Qty: _______
- [ ] **Spare Wire**: AWG: _______, Length: _______m
- [ ] **Spare Buck Converters**: Qty: _______
- [ ] **Spare Arduino**: Qty: _______
- [ ] **Spare ESP8266**: Qty: _______

---

## 10. Risk Assessment & Mitigation

### 10.1 Identified Risks

```
Risk                      | Severity | Likelihood | Mitigation
--------------------------|----------|------------|---------------------------
Battery fire/explosion    | CRITICAL | LOW        | BMS, thermal monitoring, E-stop
Motor runaway             | HIGH     | LOW        | Software limits, E-stop
Over-current damage       | MEDIUM   | MEDIUM     | Current limiting, fuses
WiFi loss of control      | HIGH     | MEDIUM     | Timeout auto-stop, manual override
Controller failure        | MEDIUM   | LOW        | Failsafe modes, redundancy
Thermal damage            | MEDIUM   | MEDIUM     | Thermal monitoring, forced cooling
Structural failure        | HIGH     | LOW        | Load testing, regular inspection
```

### 10.2 Safety Certifications

- [ ] **Electrical Safety Review**: Date: _______ Reviewer: _________
- [ ] **Mechanical Safety Review**: Date: _______ Reviewer: _________
- [ ] **Software Safety Review**: Date: _______ Reviewer: _________
- [ ] **Operational Safety Training**: Date: _______ Operator: _________

---

## 11. References & Documentation

### 11.1 Component Documentation

All component datasheets and detailed documentation are located in:
```
/home/wtyler/RoverShit/OmniTrek/
```

**Key Documents**:
- Arduino Mega 2560: `Arduino%20Mega%202560%20Documentation.pdf.pdf`
- ESP8266 NodeMCU: `NodeMCU%20Amica%20(ESP8266)%20Documentation.pdf.pdf`
- Hoverboard Motors: `Hoverboard%20Brushless%20Hub%20Motor%20Documentation.pdf.pdf`
- Battery Pack: `Hoverboard%20Batteries%20Documentation.pdf.pdf`
- Motor Controller: `RioRand%20High%20Voltage%20Motor%20Controller%20Documentation.pdf.pdf`
- Buck Converters: `LM2596%20DC-DC%20Step-Down%20Buck%20Converter%20Documentation.pdf.pdf`
- Frame: `Salvaged%20Hoverboard%20Metal%20Frame%20Documentation.pdf.pdf`

### 11.2 Project Documentation

- Complete Build Guide: `OmniTrek Rover - The Obsessively Detailed Plan.pdf.pdf`
- Phase Documentation: `OmniTrek - Phase X Deep Dive` series (0-11)
- Parts List: `OmniTrek Rover Parts List.pdf.pdf`

### 11.3 Software Integration

- Multi-Controller App: `/home/wtyler/multi-controller-app/`
- Arduino Firmware: (TBD - location to be specified)
- ESP8266 Firmware: (TBD - location to be specified)

---

## 12. Change Log

```
Date       | Change Description                                    | Initials
-----------|-------------------------------------------------------|----------
2025-10-12 | Initial inventory document created                    | System
           |                                                       |
           |                                                       |
           |                                                       |
```

---

## 13. Sign-Off & Approval

### 13.1 Safety Certification Sign-Off

**I certify that all safety systems have been tested and verified functional:**

- **Electrical Safety**: ________________ Date: _______ Signature: _________
- **Mechanical Safety**: ________________ Date: _______ Signature: _________
- **Software Safety**: ________________ Date: _______ Signature: _________

### 13.2 Operational Approval

**System approved for operational testing:**

- **Project Lead**: ________________ Date: _______ Signature: _________

---

**END OF INVENTORY DOCUMENT**
