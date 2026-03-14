# OmniTrek Nexus Wiring Diagram Documentation Index

## NotebookLM Source Documents for OmniTrek Nexus Project

**Created:** December 28, 2025  
**Purpose:** Comprehensive wiring documentation for NotebookLM audio overview generation

---

## Document Set Overview

This collection contains seven detailed wiring diagram documents optimized for NotebookLM ingestion. Each document follows structured formatting with clear headings, technical specifications, ASCII diagrams, and verification checklists.

### Upload Order Recommendation

For optimal NotebookLM synthesis, upload in this order:

1. **Complete System Overview (Document 5)** - Start with the big picture
2. **Power System (Document 7)** - Foundation power architecture
3. **Individual MC Documents (1-4)** - Detailed per-controller wiring
4. **Motor Wiring (Document 6)** - Phase and Hall sensor connections

---

## Document Index

### 1. NodeMCU 32S to Motor Controller 1 Wiring
**File:** `01_NodeMCU32S_to_MC1_Wiring.md`  
**Size:** ~8KB  
**Topics Covered:**
- NodeMCU GPIO 25, 26, 27 for PWM/DIR/BRK
- GPIO 32, 33, 34 for Hall sensor feedback
- 100Ω PWM protection resistors
- 4.7K pullup resistors for Hall inputs
- Front-left motor control

### 2. NodeMCU 32S to Motor Controller 2 Wiring
**File:** `02_NodeMCU32S_to_MC2_Wiring.md`  
**Size:** ~9KB  
**Topics Covered:**
- NodeMCU GPIO 14, 12, 13 for PWM/DIR/BRK
- GPIO 35, 36, 39 for Hall sensor feedback (input-only pins)
- External pullup requirements for input-only GPIOs
- Direction inversion for right-side motor
- Differential steering coordination

### 3. NodeMCU 32S to Motor Controller 3 Wiring
**File:** `03_NodeMCU32S_to_MC3_Wiring.md`  
**Size:** ~9KB  
**Topics Covered:**
- NodeMCU GPIO 16, 17, 18 for PWM/DIR/BRK
- GPIO 19, 21, 22 for Hall sensor feedback
- Extended wire runs for rear motor
- Left-side tandem control with MC1
- Shielded cable requirements

### 4. NodeMCU 32S to Motor Controller 4 Wiring
**File:** `04_NodeMCU32S_to_MC4_Wiring.md`  
**Size:** ~10KB  
**Topics Covered:**
- NodeMCU GPIO 23, 4, 5 for PWM/DIR/BRK
- GPIO 2, 15, 0 for Hall feedback (strapping pins!)
- 74HC14 buffer IC for strapping pin protection
- Boot sequence considerations
- Complete 4WD GPIO map summary

### 5. NodeMCU 32S to ALL Motor Controllers (Complete System)
**File:** `05_NodeMCU32S_to_ALL_MCs_Complete.md`  
**Size:** ~18KB  
**Topics Covered:**
- Complete GPIO assignment table
- Full system ASCII schematic
- Physical layout diagram
- Power distribution overview
- Signal conditioning component network
- Wire bundle organization
- Complete firmware initialization code
- Master verification checklist

### 6. Motor Controllers to Wheel Motors
**File:** `06_MotorControllers_to_Motors_Wiring.md`  
**Size:** ~14KB  
**Topics Covered:**
- Hoverboard motor specifications
- Three-phase power wiring (U, V, W)
- Hall sensor connector pinout
- Phase wire direction reversal methods
- Hall sensor sequence verification
- Extension cable wiring for rear motors
- Motor testing procedures
- Troubleshooting guide

### 7. Batteries and Power System
**File:** `07_Battery_PowerSystem_Wiring.md`  
**Size:** ~16KB  
**Topics Covered:**
- 36V battery configurations (Lead Acid, Li-ion, LiFePO4)
- Series battery wiring diagram
- Main power distribution block
- Voltage regulation (36V→12V→5V)
- Emergency stop circuit
- Low voltage disconnect (LVD)
- Battery Management System (BMS)
- Charging system wiring
- Power monitoring with ADC
- Complete power system schematic

---

## Audio Overview Customization Prompts

### For Full System Overview
```
Focus on the complete 4WD motor control architecture, explaining how the NodeMCU 32S 
connects to all four RioRand motor controllers. Cover GPIO assignments, power distribution, 
and the relationship between front and rear motor pairs. Explain for someone building 
a rover from scratch.
```

### For Motor Wiring Deep Dive
```
Explain the three-phase motor wiring and Hall sensor connections in detail. Focus on 
troubleshooting common issues like wrong rotation direction, erratic motor behavior, 
and Hall sensor sequence verification. Include practical testing procedures.
```

### For Power System Focus
```
Cover the battery pack configuration, power distribution, and safety systems. Explain 
the voltage regulation chain from 36V down to 5V for the microcontroller. Emphasize 
safety features like emergency stop, fusing, and low voltage protection.
```

### For Individual Controller Setup
```
Walk through the wiring process for connecting a single motor controller to the 
NodeMCU 32S. Cover signal wiring, Hall sensor connections, and verification steps. 
Explain what to check before connecting the motor.
```

---

## Technical Specifications Summary

### GPIO Allocation Overview

| Function | MC1 (FL) | MC2 (FR) | MC3 (RL) | MC4 (RR) |
|----------|----------|----------|----------|----------|
| PWM | GPIO 25 | GPIO 14 | GPIO 16 | GPIO 23 |
| DIR | GPIO 26 | GPIO 12 | GPIO 17 | GPIO 4 |
| BRK | GPIO 27 | GPIO 13 | GPIO 18 | GPIO 5 |
| Hall-A | GPIO 32 | GPIO 35 | GPIO 19 | GPIO 2* |
| Hall-B | GPIO 33 | GPIO 36 | GPIO 21 | GPIO 15* |
| Hall-C | GPIO 34 | GPIO 39 | GPIO 22 | GPIO 0* |

*Strapping pins requiring buffer IC

### Power System Summary

| Rail | Source | Current | Purpose |
|------|--------|---------|---------|
| 36V | Battery Pack | 80A peak | Motor controllers |
| 12V | DC-DC Converter | 10A | Accessories, fans |
| 5V | Voltage Regulator | 3A | NodeMCU, sensors |
| 3.3V | NodeMCU Onboard | 500mA | Logic signals |

### Wire Gauge Summary

| Circuit | Gauge | Current Rating |
|---------|-------|----------------|
| Battery Main | 4 AWG | 100A |
| Motor Controller Power | 10 AWG | 30A |
| Motor Phase Wires | 12 AWG | 20A |
| Signal Wires | 22 AWG | 1A |
| Hall Sensors | 22 AWG shielded | 100mA |

---

## Usage Notes for NotebookLM

### Optimal Source Configuration
- Upload all 7 documents to single notebook for comprehensive coverage
- Or split into 2 notebooks: "Motor Control" (1-6) and "Power System" (7)

### Study Guide Generation
Request study guides focusing on:
- GPIO assignment memorization
- Wiring order/sequence
- Safety checklist steps
- Troubleshooting decision trees

### FAQ Generation
Good topics for FAQ:
- "What happens if I swap phase wires?"
- "Why do right-side motors need direction inversion?"
- "How do I test Hall sensors before connecting?"
- "What fuse sizes do I need?"

### Timeline Generation
Use for project planning:
- Wiring order sequence (MC1 → MC2 → MC3 → MC4)
- Testing milestones (individual → paired → full system)
- Safety verification checkpoints

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 28, 2025 | Initial complete document set |

---

*Generated for OmniTrek Nexus Project - Tyler's 4WD Rover Control System*
