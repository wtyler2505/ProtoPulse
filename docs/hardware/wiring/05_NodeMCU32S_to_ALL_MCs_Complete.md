# OmniTrek Nexus Complete Wiring Diagram: NodeMCU 32S to All Motor Controllers

## Document Overview

This document provides the complete, integrated wiring schematic for connecting the NodeMCU 32S microcontroller to all four RioRand 350W BLDC Motor Controllers in the OmniTrek Nexus 4WD rover system. This is the master reference document for the entire motor control subsystem.

## System Architecture Summary

### Component Inventory

**Microcontroller:**
- 1× NodeMCU 32S (ESP32-WROOM-32)

**Motor Controllers:**
- 4× RioRand 350W BLDC Motor Controllers
  - MC1: Front-Left (FL) wheel
  - MC2: Front-Right (FR) wheel
  - MC3: Rear-Left (RL) wheel
  - MC4: Rear-Right (RR) wheel

**Motors:**
- 4× Hoverboard BLDC motors (36V, 350W each)
- Each motor includes 3-wire Hall sensor package

**Supporting Components:**
- 4× 100Ω resistors (PWM signal protection)
- 4× 10K pulldown resistors (direction pin stability)
- 12× 4.7K pullup resistors (Hall sensor inputs)
- 12× 100pF ceramic capacitors (Hall sensor filtering)
- 1× 74HC14 Schmitt trigger IC (MC4 strapping pin buffer)
- Shielded cable for rear motor Hall sensors
- Terminal blocks for power distribution

## Complete GPIO Assignment Table

### Primary Motor Control Signals

```
╔═══════════╤════════════╤════════════╤════════════╤════════════╗
║ Function  │   MC1 (FL) │   MC2 (FR) │   MC3 (RL) │   MC4 (RR) ║
╠═══════════╪════════════╪════════════╪════════════╪════════════╣
║ PWM Speed │   GPIO 25  │   GPIO 14  │   GPIO 16  │   GPIO 23  ║
╟───────────┼────────────┼────────────┼────────────┼────────────╢
║ Direction │   GPIO 26  │   GPIO 12  │   GPIO 17  │   GPIO 4   ║
╟───────────┼────────────┼────────────┼────────────┼────────────╢
║ Brake     │   GPIO 27  │   GPIO 13  │   GPIO 18  │   GPIO 5   ║
╚═══════════╧════════════╧════════════╧════════════╧════════════╝
```

### Hall Sensor Feedback Signals

```
╔═══════════╤════════════╤════════════╤════════════╤════════════╗
║ Function  │   MC1 (FL) │   MC2 (FR) │   MC3 (RL) │   MC4 (RR) ║
╠═══════════╪════════════╪════════════╪════════════╪════════════╣
║ Hall-A    │   GPIO 32  │   GPIO 35  │   GPIO 19  │   GPIO 2*  ║
╟───────────┼────────────┼────────────┼────────────┼────────────╢
║ Hall-B    │   GPIO 33  │   GPIO 36  │   GPIO 21  │   GPIO 15* ║
╟───────────┼────────────┼────────────┼────────────┼────────────╢
║ Hall-C    │   GPIO 34  │   GPIO 39  │   GPIO 22  │   GPIO 0*  ║
╚═══════════╧════════════╧════════════╧════════════╧════════════╝
* Strapping pins - require buffer IC protection
```

### GPIO Usage Summary

**Total GPIO Pins Used: 24**
- PWM outputs: 4 pins
- Direction outputs: 4 pins
- Brake outputs: 4 pins
- Hall sensor inputs: 12 pins

**Remaining Available GPIO:**
- SPI: GPIO 6, 7, 8, 9, 10, 11 (internal flash - do not use)
- I2C: GPIO 21 (used for Hall), GPIO 22 (used for Hall)
- UART0: GPIO 1, 3 (USB serial - reserve for debugging)
- Free: GPIO 20 (not recommended), GPIO 24-31 (limited use)

## Complete System Wiring Diagram

### Master Schematic (ASCII)

```
                            ╔══════════════════════════════════════════════════════════════════════════════╗
                            ║                          OMNITREK NEXUS 4WD MOTOR CONTROL SYSTEM             ║
                            ╚══════════════════════════════════════════════════════════════════════════════╝

                                                        ┌─────────────────────┐
                                                        │    NodeMCU 32S      │
                                                        │   (Central MCU)     │
                                                        │                     │
                                                        │  ┌───────────────┐  │
     ┌──────────────────────────────────────────────────┤◄─┤ GPIO 25 (PWM) │  │
     │                                                  │  ├───────────────┤  │
     │  ┌───────────────────────────────────────────────┤◄─┤ GPIO 26 (DIR) │  │
     │  │                                               │  ├───────────────┤  │
     │  │  ┌────────────────────────────────────────────┤◄─┤ GPIO 27 (BRK) │  │
     │  │  │                                            │  ├───────────────┤  │
     │  │  │  ┌─────────────────────────────────────────┤►─┤ GPIO 32 (HA)  │  │
     │  │  │  │  ┌──────────────────────────────────────┤►─┤ GPIO 33 (HB)  │  │
     │  │  │  │  │  ┌───────────────────────────────────┤►─┤ GPIO 34 (HC)  │  │
     │  │  │  │  │  │                                   │  │               │  │
     │  │  │  │  │  │                                   │  ├═══════════════┤  │
     │  │  │  │  │  │  ┌────────────────────────────────┤◄─┤ GPIO 14 (PWM) │  │
     │  │  │  │  │  │  │  ┌─────────────────────────────┤◄─┤ GPIO 12 (DIR) │  │
     │  │  │  │  │  │  │  │  ┌──────────────────────────┤◄─┤ GPIO 13 (BRK) │  │
     │  │  │  │  │  │  │  │  │  ┌───────────────────────┤►─┤ GPIO 35 (HA)  │  │
     │  │  │  │  │  │  │  │  │  │  ┌────────────────────┤►─┤ GPIO 36 (HB)  │  │
     │  │  │  │  │  │  │  │  │  │  │  ┌─────────────────┤►─┤ GPIO 39 (HC)  │  │
     │  │  │  │  │  │  │  │  │  │  │  │                 │  │               │  │
     │  │  │  │  │  │  │  │  │  │  │  │                 │  ├═══════════════┤  │
     │  │  │  │  │  │  │  │  │  │  │  │  ┌──────────────┤◄─┤ GPIO 16 (PWM) │  │
     │  │  │  │  │  │  │  │  │  │  │  │  │  ┌───────────┤◄─┤ GPIO 17 (DIR) │  │
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  ┌────────┤◄─┤ GPIO 18 (BRK) │  │
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  ┌─────┤►─┤ GPIO 19 (HA)  │  │
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  ┌──┤►─┤ GPIO 21 (HB)  │  │
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │►─┤ GPIO 22 (HC)  │  │
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │               │  │
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  ├═══════════════┤  │
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  ├◄─┤ GPIO 23 (PWM) │  │──┐
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  ├◄─┤ GPIO 4  (DIR) │  │──┼──┐
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  ├◄─┤ GPIO 5  (BRK) │  │──┼──┼──┐
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  ├►─┤ GPIO 2  (HA)* │  │──┼──┼──┼──┐
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  ├►─┤ GPIO 15 (HB)* │  │──┼──┼──┼──┼──┐
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  ├►─┤ GPIO 0  (HC)* │  │──┼──┼──┼──┼──┼──┐
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │               │  │  │  │  │  │  │  │
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │      GND ●────┼──┴──┴──┴──┴──┴──┴──┴─── COMMON GROUND
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │               │  │
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  └───────────────┘  │
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │                     │
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  └─────────────────────┘
     │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  
     ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼

 ╔═══════════════════════╗            ╔═══════════════════════╗
 ║ MC1 - FRONT LEFT (FL) ║            ║ MC2 - FRONT RIGHT (FR)║
 ╠═══════════════════════╣            ╠═══════════════════════╣
 ║ PWM ◄──[100Ω]─────────╫── GPIO 25  ║ PWM ◄──[100Ω]─────────╫── GPIO 14
 ║ DIR ◄─────────────────╫── GPIO 26  ║ DIR ◄─────────────────╫── GPIO 12
 ║ BRK ◄─────────────────╫── GPIO 27  ║ BRK ◄─────────────────╫── GPIO 13
 ║ HALL-A ───────────────╫──► GPIO 32 ║ HALL-A ───────────────╫──► GPIO 35
 ║ HALL-B ───────────────╫──► GPIO 33 ║ HALL-B ───────────────╫──► GPIO 36
 ║ HALL-C ───────────────╫──► GPIO 34 ║ HALL-C ───────────────╫──► GPIO 39
 ║ 5V OUT ───► Hall VCC  ║            ║ 5V OUT ───► Hall VCC  ║
 ║ GND ──┬───► Hall GND  ║            ║ GND ──┬───► Hall GND  ║
 ╚═══════╪═══════════════╝            ╚═══════╪═══════════════╝
         │                                    │
         ▼                                    ▼
    ┌─────────┐                          ┌─────────┐
    │ MOTOR 1 │                          │ MOTOR 2 │
    │  (FL)   │                          │  (FR)   │
    └─────────┘                          └─────────┘


 ╔═══════════════════════╗            ╔═══════════════════════╗
 ║ MC3 - REAR LEFT (RL)  ║            ║ MC4 - REAR RIGHT (RR) ║
 ╠═══════════════════════╣            ╠═══════════════════════╣
 ║ PWM ◄──[100Ω]─────────╫── GPIO 16  ║ PWM ◄──[100Ω]─────────╫── GPIO 23
 ║ DIR ◄─────────────────╫── GPIO 17  ║ DIR ◄─────────────────╫── GPIO 4
 ║ BRK ◄─────────────────╫── GPIO 18  ║ BRK ◄─────────────────╫── GPIO 5
 ║ HALL-A ───────────────╫──► GPIO 19 ║ HALL-A ──[Buffer]─────╫──► GPIO 2*
 ║ HALL-B ───────────────╫──► GPIO 21 ║ HALL-B ──[Buffer]─────╫──► GPIO 15*
 ║ HALL-C ───────────────╫──► GPIO 22 ║ HALL-C ──[Buffer]─────╫──► GPIO 0*
 ║ 5V OUT ───► Hall VCC  ║            ║ 5V OUT ───► Hall VCC  ║
 ║ GND ──┬───► Hall GND  ║            ║ GND ──┬───► Hall GND  ║
 ╚═══════╪═══════════════╝            ╚═══════╪═══════════════╝
         │                                    │
         ▼                                    ▼
    ┌─────────┐                          ┌─────────┐
    │ MOTOR 3 │                          │ MOTOR 4 │
    │  (RL)   │                          │  (RR)   │
    └─────────┘                          └─────────┘

         ▲                                    ▲
         └────────────── COMMON GROUND ───────┘
```

### Physical Layout (Top View)

```
                           FRONT OF ROVER
    ════════════════════════════════════════════════════
    
    ┌─────────────┐                      ┌─────────────┐
    │   MOTOR 1   │                      │   MOTOR 2   │
    │ (Front-Left)│                      │(Front-Right)│
    │   ⟳ ←       │                      │     → ⟳     │
    └─────┬───────┘                      └───────┬─────┘
          │ Phase + Hall                         │ Phase + Hall
          ▼                                      ▼
    ┌─────────────┐                      ┌─────────────┐
    │    MC1      │                      │    MC2      │
    │  RioRand    │──────┐        ┌──────│  RioRand    │
    │  350W BLDC  │      │        │      │  350W BLDC  │
    └─────────────┘      │        │      └─────────────┘
          │              │        │              │
          │ Control      ▼        ▼      Control │
          │         ╔═════════════════╗          │
          └─────────╣   NodeMCU 32S   ╠──────────┘
          ┌─────────╣   (ESP32)       ╠──────────┐
          │         ╚═════════════════╝          │
          │ Control      ▲        ▲      Control │
          │              │        │              │
    ┌─────────────┐      │        │      ┌─────────────┐
    │    MC3      │──────┘        └──────│    MC4      │
    │  RioRand    │                      │  RioRand    │
    │  350W BLDC  │                      │  350W BLDC  │
    └─────────────┘                      └─────────────┘
          ▲ Phase + Hall                         ▲ Phase + Hall
          │                                      │
    ┌─────┴───────┐                      ┌───────┴─────┐
    │   MOTOR 3   │                      │   MOTOR 4   │
    │ (Rear-Left) │                      │(Rear-Right) │
    │   ⟳ ←       │                      │     → ⟳     │
    └─────────────┘                      └─────────────┘
    
    ════════════════════════════════════════════════════
                           REAR OF ROVER
```

## Power Distribution

### Ground Network (Star Topology)

All grounds must connect to a single central point to prevent ground loops:

```
                    CENTRAL GROUND POINT
                           ●
                          /│\
                         / │ \
                        /  │  \
                       /   │   \
            ┌─────────┘    │    └─────────┐
            │              │              │
            ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │  NodeMCU   │ │   Power    │ │  All MCs   │
     │    GND     │ │   Supply   │ │    GND     │
     └────────────┘ │    GND     │ └────────────┘
                    └────────────┘
                           ▲
                           │
               ┌───────────┼───────────┐
               │           │           │
               ▼           ▼           ▼
            MC1 GND     MC2 GND     MC3 GND     MC4 GND
```

### 36V Power Distribution

Motor controllers connect in parallel to the 36V battery bank:

```
    ┌──────────────────────────────────────────────────────────────┐
    │                     36V BATTERY BANK                         │
    │   ┌────────┐ ┌────────┐ ┌────────┐ (3× 12V in series)       │
    │   │  12V   │─│  12V   │─│  12V   │                          │
    │   └────────┘ └────────┘ └────────┘                          │
    └─────┬────────────────────────────────────────────┬──────────┘
          │ (+36V)                                     │ (GND)
          │                                            │
          ├─────────► MC1 (+36V IN)    MC1 (GND) ◄─────┤
          │                                            │
          ├─────────► MC2 (+36V IN)    MC2 (GND) ◄─────┤
          │                                            │
          ├─────────► MC3 (+36V IN)    MC3 (GND) ◄─────┤
          │                                            │
          └─────────► MC4 (+36V IN)    MC4 (GND) ◄─────┤
                                                       │
                                       Central Ground ◄┘
```

## Signal Conditioning Components

### Pullup/Pulldown Resistor Network

```
3.3V Rail ───┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
             │     │     │     │     │     │     │     │     │     │     │     │
           [4.7K][4.7K][4.7K][4.7K][4.7K][4.7K][4.7K][4.7K][4.7K][4.7K][4.7K][4.7K]
             │     │     │     │     │     │     │     │     │     │     │     │
             ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼
           G32   G33   G34   G35   G36   G39   G19   G21   G22   G2    G15   G0
          (MC1  (MC1  (MC1  (MC2  (MC2  (MC2  (MC3  (MC3  (MC3  (MC4  (MC4  (MC4
           HA)   HB)   HC)   HA)   HB)   HC)   HA)   HB)   HC)   HA)   HB)   HC)

Direction Pin Pulldowns:
             │     │     │     │
GND ────────┬─────┬─────┬─────┤
           [10K][10K][10K][10K]
             │     │     │     │
             ▼     ▼     ▼     ▼
           G26   G12   G17   G4
          (MC1  (MC2  (MC3  (MC4
           DIR)  DIR)  DIR)  DIR)
```

### Hall Sensor Filtering Capacitors

Each Hall sensor input receives a 100pF bypass capacitor to ground:

```
GPIO Pin ──●───────────► Signal Processing
           │
         [100pF]
           │
          GND
```

## Firmware Architecture

### PWM Channel Assignment

```cpp
// PWM Channel Configuration
#define PWM_FREQ     20000    // 20kHz for motor controllers
#define PWM_RES      8        // 8-bit resolution (0-255)

#define MC1_PWM_CH   0        // GPIO 25
#define MC2_PWM_CH   1        // GPIO 14
#define MC3_PWM_CH   2        // GPIO 16
#define MC4_PWM_CH   3        // GPIO 23
```

### Complete GPIO Initialization

```cpp
void initializeMotorControl() {
    // === PWM OUTPUTS ===
    ledcSetup(MC1_PWM_CH, PWM_FREQ, PWM_RES);
    ledcAttachPin(25, MC1_PWM_CH);
    
    ledcSetup(MC2_PWM_CH, PWM_FREQ, PWM_RES);
    ledcAttachPin(14, MC2_PWM_CH);
    
    ledcSetup(MC3_PWM_CH, PWM_FREQ, PWM_RES);
    ledcAttachPin(16, MC3_PWM_CH);
    
    ledcSetup(MC4_PWM_CH, PWM_FREQ, PWM_RES);
    ledcAttachPin(23, MC4_PWM_CH);
    
    // === DIRECTION OUTPUTS ===
    pinMode(26, OUTPUT);  // MC1 DIR
    pinMode(12, OUTPUT);  // MC2 DIR
    pinMode(17, OUTPUT);  // MC3 DIR
    pinMode(4, OUTPUT);   // MC4 DIR
    
    // === BRAKE OUTPUTS ===
    pinMode(27, OUTPUT);  // MC1 BRK
    pinMode(13, OUTPUT);  // MC2 BRK
    pinMode(18, OUTPUT);  // MC3 BRK
    pinMode(5, OUTPUT);   // MC4 BRK
    
    // === HALL SENSOR INPUTS ===
    // MC1 Hall (GPIO 32, 33, 34)
    pinMode(32, INPUT);
    pinMode(33, INPUT);
    pinMode(34, INPUT);
    
    // MC2 Hall (GPIO 35, 36, 39 - input only)
    pinMode(35, INPUT);
    pinMode(36, INPUT);
    pinMode(39, INPUT);
    
    // MC3 Hall (GPIO 19, 21, 22 - with pullup)
    pinMode(19, INPUT_PULLUP);
    pinMode(21, INPUT_PULLUP);
    pinMode(22, INPUT_PULLUP);
    
    // MC4 Hall - delayed init for strapping pins
    // See boot sequence below
}

void initMC4HallAfterBoot() {
    delay(100);  // Ensure boot complete
    pinMode(2, INPUT);   // MC4 HA (onboard LED)
    pinMode(15, INPUT);  // MC4 HB (boot pin)
    pinMode(0, INPUT);   // MC4 HC (boot pin)
}
```

### Unified Motor Control Functions

```cpp
struct MotorCommand {
    uint8_t speed;      // 0-255 PWM duty
    bool forward;       // Direction
    bool brake;         // Brake engaged
};

void setMotor(int motorId, MotorCommand cmd) {
    switch(motorId) {
        case 1:  // Front-Left
            ledcWrite(MC1_PWM_CH, cmd.speed);
            digitalWrite(26, cmd.forward);
            digitalWrite(27, cmd.brake);
            break;
        case 2:  // Front-Right (inverted direction)
            ledcWrite(MC2_PWM_CH, cmd.speed);
            digitalWrite(12, !cmd.forward);  // Inverted!
            digitalWrite(13, cmd.brake);
            break;
        case 3:  // Rear-Left
            ledcWrite(MC3_PWM_CH, cmd.speed);
            digitalWrite(17, cmd.forward);
            digitalWrite(18, cmd.brake);
            break;
        case 4:  // Rear-Right (inverted direction)
            ledcWrite(MC4_PWM_CH, cmd.speed);
            digitalWrite(4, !cmd.forward);   // Inverted!
            digitalWrite(5, cmd.brake);
            break;
    }
}

void setAllMotors(MotorCommand cmd) {
    setMotor(1, cmd);
    setMotor(2, cmd);
    setMotor(3, cmd);
    setMotor(4, cmd);
}

void emergencyStop() {
    MotorCommand stop = {0, true, true};
    setAllMotors(stop);
}
```

## Wire Routing Guidelines

### Cable Management Zones

```
    ╔══════════════════════════════════════════════════════════════╗
    ║                        FRONT                                 ║
    ╠══════════════════════════════════════════════════════════════╣
    ║  ZONE A               │               ZONE B                 ║
    ║  (MC1 + Motor 1)      │               (MC2 + Motor 2)        ║
    ║                       │                                      ║
    ║  • Keep MC1 wires     │  • Keep MC2 wires                    ║
    ║    on left side       │    on right side                     ║
    ║  • Short signal runs  │  • Short signal runs                 ║
    ║                       │                                      ║
    ╠═══════════════════════╪══════════════════════════════════════╣
    ║                    ZONE C                                    ║
    ║             (Central Control Area)                           ║
    ║                                                              ║
    ║    • NodeMCU mounted centrally                               ║
    ║    • All signal wires converge here                          ║
    ║    • Star ground point located here                          ║
    ║    • Power distribution from here                            ║
    ║                                                              ║
    ╠═══════════════════════╪══════════════════════════════════════╣
    ║  ZONE D               │               ZONE E                 ║
    ║  (MC3 + Motor 3)      │               (MC4 + Motor 4)        ║
    ║                       │                                      ║
    ║  • Longer cable runs  │  • Longer cable runs                 ║
    ║  • Use shielded cable │  • Use shielded cable                ║
    ║  • Buffer IC for MC4  │  • Extra filtering                   ║
    ║                       │                                      ║
    ╠══════════════════════════════════════════════════════════════╣
    ║                        REAR                                  ║
    ╚══════════════════════════════════════════════════════════════╝
```

### Wire Bundle Organization

**Bundle 1: Left Side Control (7 wires)**
- MC1 PWM (yellow)
- MC1 DIR (orange)
- MC1 BRK (white)
- MC3 PWM (blue)
- MC3 DIR (purple)
- MC3 BRK (gray)
- Left side shared ground (black)

**Bundle 2: Right Side Control (7 wires)**
- MC2 PWM (yellow striped)
- MC2 DIR (orange striped)
- MC2 BRK (white striped)
- MC4 PWM (blue striped)
- MC4 DIR (purple striped)
- MC4 BRK (gray striped)
- Right side shared ground (black)

**Bundle 3: Front Hall Sensors (10 wires)**
- MC1 Hall-A, B, C (shielded, 3 conductors)
- MC2 Hall-A, B, C (shielded, 3 conductors)
- MC1 Hall VCC/GND
- MC2 Hall VCC/GND

**Bundle 4: Rear Hall Sensors (10 wires)**
- MC3 Hall-A, B, C (shielded, 3 conductors)
- MC4 Hall-A, B, C (shielded, 3 conductors)
- MC3 Hall VCC/GND
- MC4 Hall VCC/GND

## Complete Bill of Materials

### Electronic Components

| Qty | Component | Value/Spec | Purpose |
|-----|-----------|------------|---------|
| 1 | NodeMCU 32S | ESP32-WROOM-32 | Main controller |
| 4 | RioRand BLDC Controller | 350W, 36V | Motor drivers |
| 4 | Hoverboard Motor | 36V, 350W | Drive motors |
| 4 | Resistor | 100Ω, 1/4W | PWM protection |
| 4 | Resistor | 10KΩ, 1/4W | DIR pulldowns |
| 12 | Resistor | 4.7KΩ, 1/4W | Hall pullups |
| 12 | Capacitor | 100pF ceramic | Hall filtering |
| 1 | 74HC14 | Hex Schmitt Trigger | MC4 buffer |
| 1 | Terminal Block | 10-position | Power distribution |

### Wire and Cable

| Qty | Type | Gauge | Length | Purpose |
|-----|------|-------|--------|---------|
| 15m | Stranded Wire | 22 AWG | Various | Signal connections |
| 5m | Stranded Wire | 18 AWG | Various | Ground network |
| 4m | Shielded Cable | 22 AWG, 4-cond | 1m each | Rear Hall sensors |
| 10 | Ring Terminal | 18 AWG | - | Ground connections |
| 40 | Crimp Terminal | 22 AWG | - | Signal connections |
| 4 | Ferrite Bead | 10mm ID | - | EMI suppression |

## Complete System Verification Checklist

### Pre-Power Verification

- [ ] All connections match GPIO assignment table
- [ ] Continuity verified on all signal wires
- [ ] No short circuits between power and ground
- [ ] No short circuits between signal lines
- [ ] All pullup/pulldown resistors installed
- [ ] Buffer IC correctly wired for MC4
- [ ] Star ground topology verified
- [ ] All motor phase connections secure
- [ ] Hall sensor power isolated per controller

### Power-On Sequence

1. [ ] Disconnect all motors (phase wires)
2. [ ] Power NodeMCU via USB only
3. [ ] Verify firmware uploads successfully
4. [ ] Check all GPIO outputs with multimeter
5. [ ] Verify PWM signals with oscilloscope
6. [ ] Power motor controllers (36V)
7. [ ] Verify 5V Hall power outputs
8. [ ] Reconnect motors one at a time
9. [ ] Test each motor individually

### Functional Test Matrix

| Test | MC1 | MC2 | MC3 | MC4 | Pass |
|------|-----|-----|-----|-----|------|
| PWM Response | [ ] | [ ] | [ ] | [ ] | |
| Forward Direction | [ ] | [ ] | [ ] | [ ] | |
| Reverse Direction | [ ] | [ ] | [ ] | [ ] | |
| Brake Function | [ ] | [ ] | [ ] | [ ] | |
| Hall-A Signal | [ ] | [ ] | [ ] | [ ] | |
| Hall-B Signal | [ ] | [ ] | [ ] | [ ] | |
| Hall-C Signal | [ ] | [ ] | [ ] | [ ] | |
| RPM Reading | [ ] | [ ] | [ ] | [ ] | |

### Integration Tests

- [ ] Forward travel: All 4 motors synchronized
- [ ] Reverse travel: All 4 motors synchronized
- [ ] Left turn: MC1/MC3 reduced, MC2/MC4 full
- [ ] Right turn: MC2/MC4 reduced, MC1/MC3 full
- [ ] Spin left: MC1/MC3 reverse, MC2/MC4 forward
- [ ] Spin right: MC1/MC3 forward, MC2/MC4 reverse
- [ ] Emergency stop: All motors halt within 0.5s
- [ ] Single motor failure: System degrades gracefully
