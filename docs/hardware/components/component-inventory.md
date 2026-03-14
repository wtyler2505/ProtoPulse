---
# LLM Optimization Metadata
metadata:
  document_id: hardware-components-component-inventory
  document_type: technical-reference
  target_audience:
    - intermediate
    - advanced
    - developers
    - hardware-engineers
  complexity_level: advanced
  estimated_read_time: 12 minutes
  last_updated: '2025-11-05'
  version: 1.0.0
tags:
  - hardware
  - specifications
  - electronics
  - components
key_entities:
  - 'Arduino Mega 2560: Main microcontroller for motor control'
  - 'NodeMCU ESP-32S: Primary WiFi and Bluetooth module'
  - 'NodeMCU ESP8266: WiFi communication bridge'
  - 'WebSocket: Real-time bidirectional communication protocol'
  - 'Eve: AI assistant personality system'
  - 'Motor Control: PWM-based rover movement system'
summary: Technical documentation for OmniTrek Nexus project.
depends_on:
  - README.md
---

OmniTrek Project: Component Inventory Report

1.0 Introduction

This document serves as the formal component inventory report for the OmniTrek Rover project. Its
purpose is to provide a detailed and categorized list of all available electronic components to
facilitate effective project planning, management, and hardware allocation. The inventory is
organized by the primary function of each component, offering a clear and logical overview of the
hardware assets at our disposal. This systematic approach ensures that team members can quickly
identify available parts, understand their key specifications, and assess their current operational
status.

The report begins with an overview of the core processing units: the development boards and
microcontrollers that form the rover's computational backbone.

2.0 Development Boards & Microcontrollers

Microcontrollers and their associated development boards are the strategic core of the rover's
architecture. They serve as the primary processing units responsible for executing control system
logic, integrating data from a wide array of sensors, and managing all low-level communication
protocols. The selection and allocation of these boards are critical to the rover's performance and
reliability.

2.1 Arduino Mega 2560

Component Quantity Key Specifications Status Arduino Mega 2560 1 Microcontroller:
ATmega2560<br>Clock Speed: 16 MHz<br>Memory: 256 KB Flash, 8 KB SRAM<br>I/O: 54 Digital (15 PWM), 16
Analog Designated as the main controller in the hardware stack for primary I/O and sensor
integration.

2.2 OSEPP Uno R3 Plus

Component Quantity Key Specifications Status OSEPP Uno R3 Plus 1 Microcontroller:
ATmega328P<br>Clock Speed: 16 MHz<br>Memory: 32 KB Flash, 2 KB SRAM<br>I/O: 14 Digital (6 PWM), 6
Analog<br>Power Input: 7-12V Recommended Tested working (last verified on 2025-01-10)

2.3 Arduino Uno R3

Component Quantity Key Specifications Status Arduino Uno R3 2 Microcontroller: ATmega328P<br>Clock
Speed: 16 MHz<br>Memory: 32 KB Flash, 2 KB SRAM<br>I/O: 14 Digital (6 PWM), 6 Analog<br>Power
Options: USB (5V) or DC Jack (7-12V) Untested recently (last verified on 2024-06-15)

2.4 NodeMCU ESP-32S V1.1

Component Quantity Key Specifications Status NodeMCU ESP-32S V1.1 1 Processor: ESP32-S2
Dual-Core<br>Connectivity: Built-in Wi-Fi 802.11 b/g/n & Bluetooth 5.0<br>Logic Level: 3.3V Working
(last tested on 2025-01-09)

2.5 NodeMCU Amica (ESP8266)

Component Quantity Key Specifications Status NodeMCU Amica 2 Microcontroller: ESP8266 (80/160
MHz)<br>Connectivity: Built-in Wi-Fi 802.11 b/g/n<br>Logic Level: 3.3V Working (last tested
individually on 2024-12-10)

2.6 Sparkfun Blynk Board - ESP8266

Component Quantity Key Specifications Status Sparkfun Blynk Board 2 Microcontroller:
ESP8266<br>Connectivity: Wi-Fi 802.11 b/g/n<br>Integration: Pre-configured for Blynk IoT Platform
Working (last tested on 2025-01-05)

2.7 Nano DCCduino

Component Quantity Key Specifications Status Nano DCCduino 1 Microcontroller: ATmega328P<br>Design
Focus: Digital Command Control (DCC) for model railroading.<br>Note: Functionally similar to an
Arduino Nano. Untested recently (last verified on 2024-11-20)

Engineering Summary The inventory is rich in Wi-Fi enabled microcontrollers (ESP8266/ESP32), making
it well-suited for developing a distributed network of sensor nodes or for robust
command-and-control communication. However, the single Arduino Mega 2560 represents a critical
bottleneck for high-I/O tasks; a backup or alternative should be procured for redundancy in the
primary control system.

Following the real-time control units, the inventory also includes single-board computers capable of
higher-level processing.

3.0 Single-Board Computers

Single-board computers (SBCs) are complete computers built on a single circuit board. In the context
of the OmniTrek project, they handle more complex computational tasks that complement the real-time
functions of the microcontrollers. This includes running a full operating system, hosting web
servers for local control interfaces, or processing high-level logic for advanced autonomous
behaviors.

3.1 Raspberry Pi 3 Model B+

Component Quantity Key Specifications Status Raspberry Pi 3 Model B+ 1 SoC: Broadcom BCM2837B0
(1.4GHz quad-core)<br>Memory: 1GB LPDDR2<br>Connectivity: Wi-Fi (2.4/5GHz), Bluetooth 4.2, Gigabit
Ethernet Tested working (last used on 2025-01-10)

To translate digital commands into physical movement, the project relies on a robust collection of
motor drivers and shields.

4.0 Motor Drivers & Shields

Motor drivers are a critical link in the rover's electromechanical system, fundamental to achieving
its dynamic and kinematic objectives. They function as the essential interface between the low-power
logic signals generated by microcontrollers and the high-power requirements of the motors, enabling
precise control over speed and direction.

4.1 RioRand ZS-X11H Motor Controller

Component Quantity Key Specifications Status RioRand ZS-X11H 4 Input Voltage: 6-60V DC<br>Rated
Power: 350W (16A Rated Current)<br>Motor Type: 3-phase BLDC with Hall sensors required<br>Project
Role: Primary Motor Controller Primary motor controller for the project.

4.2 L298N Dual H-Bridge DC Motor Driver

Component Quantity Key Specifications Status L298N Motor Driver 2 Driver IC: L298N<br>Motor Voltage:
5V–35V<br>Max Current: 2A per channel<br>Function: Drives two DC motors or one stepper motor.
Working (last verified on 2025-01-09)

4.3 OSEPP TB6612 Motor Shield

Component Quantity Key Specifications Status OSEPP TB6612 Shield 1 Driver IC: TB6612FNG<br>Motor
Voltage: 5V to 12V<br>Max Current: ~1.2A per channel<br>Function: Drives two DC motors or one
stepper motor. Tested working (last checked on 2025-01-08)

4.4 OSEPP Motor & Servo Shield v1.0

Component Quantity Key Specifications Status OSEPP Motor & Servo Shield 1 Driver IC: L298N<br>Motor
Voltage: 5V to 12V<br>Max Current: 2A per channel<br>Features: Includes headers for servo motor
connections. Working (last tested on 2025-01-10)

4.5 DK Electronics HW-30 Motor Control Shield

Component Quantity Key Specifications Status DK HW-30 Shield 1 Driver IC: L293D<br>Motor Voltage:
~5V to 12V<br>Max Current: ~600mA per channel Working (last tested on 2025-01-02)

4.6 ULN2003 Stepper Motor Driver Module

Component Quantity Key Specifications Status ULN2003 Driver Module 1 Driver IC: ULN2003<br>Input
Voltage: 5V–12V<br>Function: Specifically designed for driving unipolar stepper motors. Working
(last verified recently)

4.7 L293D Motor Driver IC

Component Quantity Key Specifications Status L293D Motor Driver IC 1 Type: Quadruple half-H driver
IC<br>Logic Voltage: 4.5V-7V<br>Motor Voltage: 4.5V-36V<br>Output Current: 600mA per channel Working
(last verified recently)

Engineering Summary The motor driver inventory is well-equipped for the primary drive system, with
four high-power RioRand ZS-X11H controllers designated for the brushless hub motors. This provides
full redundancy. The collection of secondary L298N and L293D-based drivers offers ample capacity for
auxiliary systems, such as robotic arms or sensor positioning servos, though their lower efficiency
should be factored into the power budget for any long-duration tasks.

With motion control established, the rover's ability to navigate and interact with its environment
depends entirely on its sensory systems.

5.0 Sensors

Sensors are the rover's primary means of perceiving its environment, providing the critical data
necessary for both autonomous and tele-operated functions. This inventory includes a diverse array
of sensors for motion detection, environmental monitoring, object avoidance, and positional
feedback, forming a comprehensive suite for advanced navigation and interaction.

5.1 Motion & Position Sensors

Component Quantity Key Specifications Status MPU-6050 Gyro/Accel Module 1 Function: 6-axis motion
tracking (3-axis accelerometer, 3-axis gyro)<br>Interface: I2C Working (last tested on 2025-01-12)
HC-SR501 PIR Motion Sensor 1 Function: Passive Infrared (PIR) motion detector<br>Range: Up to
7m<br>Output: Digital Working (last tested on 2025-01-12) Vibration Sensor (Spring) 1 Function:
Spring-based vibration/shock detector<br>Output: Digital Working (last tested on 2025-01-12)
Vibration Sensor (Reed Switch) 1 Function: Reed switch-based vibration/shock detector<br>Output:
Analog & Digital (adjustable sensitivity) Working (last tested on 2025-01-12) Vibration Sensor
(Piezoelectric) 1 Function: Ceramic piezoelectric element detects vibration/shock<br>Output: Digital
Working (last tested on 2025-01-12) Rotary Encoder Module 1 Function: Detects rotational position
and direction<br>Features: Integrated push-button switch Working (last tested recently) Ultrasonic
Sensor (HC-SR04) 1 Function: Measures distance via ultrasonic time-of-flight<br>Range: 2cm–400cm
Working (last tested recently)

5.2 Optical & Environmental Sensors

Component Quantity Key Specifications Status IR Obstacle Avoidance Sensor 2 Function: IR
emitter/detector for proximity sensing<br>Range: 2-30cm (adjustable)<br>Output: Analog & Digital
Working (last tested on 2025-01-12) OSEPP IR Follower 1 Function: Multi-sensor IR array for
line-following applications. Working (last tested on 2025-01-08) Flame Sensor Module 1 Function:
Detects flames and intense IR light sources<br>Output: Analog & Digital Working (last tested on
2025-01-12) Slot-Type Optocoupler Module 1 Function: U-shaped photo interrupter for detecting
interruptions in its optical path. Working (last tested on 2025-01-12) Soil Moisture Sensor Module 1
Function: Measures moisture via electrical conductivity<br>Output: Analog Working (last tested
recently) Sound Sensor Module 3 Function: Electret microphone with comparator<br>Output: Analog &
Digital (adjustable sensitivity) Working (last tested on 2025-01-12) Infrared Receiver Module 1
Function: Decodes 38kHz modulated IR signals from remote controls. Working (last tested on
2025-01-12)

Engineering Summary The current sensor suite provides a solid foundation for environmental
perception and basic autonomous navigation. The combination of ultrasonic and IR sensors allows for
redundant short-range obstacle avoidance. The MPU-6050 IMU is critical for orientation and stability
control. While comprehensive, the lack of a GPS module or a magnetometer limits long-range outdoor
navigation capabilities, which should be considered a priority for future hardware procurement.

Information gathered by the sensors is often relayed to the operator through displays and
indicators, which provide crucial visual feedback.

6.0 Displays & Indicators

Displays and indicators are vital for providing real-time visual feedback on the rover's status,
sensor readings, and operational mode. This category covers a range of components, from simple
status LEDs that signal binary states to character and graphical LCDs capable of supporting complex
user interfaces for diagnostics and control.

6.1 LCD & TFT Displays

Component Quantity Key Specifications Status Raspberry Pi Display v1.1 1 Size: 7-inch<br>Resolution:
800x480<br>Interface: Resistive Touch Tested working (last verified on 2025-01-10) 2.8" TFT LCD
Shield 1 Driver: ili9338<br>Resolution: 320x240<br>Interface: Resistive Touch Working (last tested
on 2024-12-15) 1602A LCD Display Module 1 Type: 16x2 Character Display<br>Interface: Parallel (4-bit
or 8-bit mode) Working (last verified recently)

6.2 LED Displays & Indicators

Component Quantity Key Specifications Status 8x8 LED Dot Matrix Display 1 Function: 64-LED grid for
displaying custom characters and symbols. Working (last verified recently) 4-Digit 7-Segment Display
1 Function: Displays numerical data across four digits. Working (last verified recently)
Single-Digit 7-Segment Display 1 Function: Displays a single numerical digit. Working (last verified
recently) RGB LED Module 2 Function: Independent R, G, B channel control via PWM for color mixing.
Working (last tested on 2025-01-12) Single LED Module 1 Function: Basic visual indicator for GPIO
signal status. Working (last tested on 2025-01-12) MAX7219 Dot Matrix Driver 1 Function: Controls
8x8 matrices or 7-segment displays via a serial interface. Working (last verified recently)

Effective operation requires not just local indicators but also robust communication links to
external control systems.

7.0 Communication & Network Modules

Communication modules are essential for connecting the rover to control interfaces, other robotic
systems, and the broader network. The available inventory provides a range of technologies, from
short-range Bluetooth for direct device pairing to long-range Wi-Fi and wired Ethernet for robust,
high-bandwidth data exchange with the command center.

7.1 Wireless Modules

Component Quantity Key Specifications Status NodeMCU ESP8266 2 Module: ESP-12E<br>Protocol: 802.11
b/g/n @ 2.4 GHz<br>Voltage: 3.3V Operating Logic Primary WiFi module, responsible for
rover-to-interface communication via WebSocket. ESP8266EX Module 3 Type: Raw Wi-Fi module based on
ESP8266EX chip.<br>Note: Requires external programmer and 3.3V supply. Untested recently (last
checked around 2024-10-01) OSEPP-BTH-01 (Rev1.1) 1 Standard: Bluetooth 4.0<br>Interface: Serial
(TX/RX) Untested recently (last verified on 2024-12-05) Rc522 RFID Module 2 Frequency:
13.56MHz<br>Compatibility: MIFARE<br>Interface: SPI Working (last checked on 2025-01-06)

7.2 Wired & Optical Modules

Component Quantity Key Specifications Status Velleman Ethernet Shield 1 Controller: W5100<br>Speed:
10/100 Mbps<br>Format: Arduino Shield Working (last verified on 2025-01-05) IR LED Transmitter
Module 2 Function: Transmits modulated infrared signals (e.g., 38kHz) for remote control
applications. Working (last tested on 2025-01-12)

Engineering Summary The project is heavily reliant on Wi-Fi for primary communication, a strategy
supported by the ample supply of ESP8266-based modules. The availability of RFID modules presents an
opportunity for implementing automated docking, charging, or payload identification tasks. The
single Velleman Ethernet shield, based on the older W5100 chip, should be considered a legacy or
backup option rather than a primary communication channel due to its lower throughput compared to
modern wireless alternatives.

To complement remote communication, a variety of input devices are available for direct, manual
control of the rover.

8.0 Input Devices

Input devices provide the means for direct user interaction with the rover, enabling manual control,
parameter adjustment, and mode selection. This category includes components ranging from simple
momentary push-buttons for discrete commands to analog joysticks and potentiometers for nuanced,
continuous control over movement and other functions.

8.1 Analog Joystick Module

Component Quantity Key Specifications Status Analog Joystick Module 1 Output: Dual-axis analog (VRx,
VRy) and one digital push-button (SW). Working (last verified recently)

8.2 Membrane Switch Module

Component Quantity Key Specifications Status Membrane Switch Module 2 Function: Tactile membrane
switch array for user keypads. Working (last tested on 2025-01-07)

8.3 Push Button Module (Tactile & Covered)

Component Quantity Key Specifications Status Push Button Module 2 Function: Momentary switch for
general-purpose digital input. Working (last tested recently)

8.4 Capacitive Touch Sensor Module

Component Quantity Key Specifications Status Capacitive Touch Sensor 1 Function: Detects
touch/proximity via capacitance change.<br>Output: Digital Working (last tested on 2025-01-12)

8.5 10K Ohm Rotary Potentiometer

Component Quantity Key Specifications Status 10K Ohm Rotary Potentiometer 1 Function: Provides
variable resistance or an analog voltage output over ~300° of travel. Working (last verified
recently)

Beyond the primary functional blocks, a number of essential support components are required for
power management and system integration.

9.0 Power, Timekeeping & Signal Conversion

This category contains essential support hardware that underpins the entire rover system. These
components are responsible for managing power distribution to high-current devices, maintaining
accurate timekeeping for data logging and scheduling, and enabling seamless communication between
subsystems that operate at different voltage levels.

Component Quantity Key Specifications Status Songle SRD-05VDC-SL-C Relay 1 Coil: 5V DC<br>Switch:
SPDT<br>Contact Rating: 10A @ 250VAC Working (last checked on 2025-01-12) P30N06LE Power MOSFET 1
Type: N-channel logic-level MOSFET<br>Ratings: Vds=60V, Id=30A Working (last verified recently)
HW-221 Logic Level Converter 2 Function: 8-channel bidirectional converter for interfacing 3.3V and
5V logic systems. Working (last verified recently) RTC Module (DS1302) 1 Chipset: DS1302<br>Backup:
CR2025 coin cell battery for maintaining time/date. Working (last tested on 2025-01-12) Laser Diode
Module 1 Type: Red laser diode (~650nm)<br>Control: Digital on/off. Working (last tested on
2025-01-12) Passive Buzzer Module 1 Function: Piezo buzzer that requires a PWM signal to produce
variable tones. Working (last tested on 2025-01-12)

Finally, the inventory includes a range of prototyping components for building, testing, and
finalizing the rover's circuitry.

10.0 Prototyping & Miscellaneous Components

These components represent the foundational hardware for building, expanding, and customizing the
rover's electronic circuits. This category includes specialized shields that simplify sensor
connections, solderable breadboards for creating permanent and robust prototypes, and other modules
that provide structural or specialized functionality.

Component Quantity Key Specifications Status OSEPP Sensor Shield 1 Function: Simplifies sensor
connections on an Arduino Uno with 3-pin headers (S, V, G). Working (last tested on 2025-01-04)
SainSmart MEGA Sensor Shield 1 Function: Designed for Arduino Mega, providing extensive 3-pin
headers for large sensor arrays. Working (last tested on 2025-01-03) Arduino MEGA Prototype Shield 1
Function: Large solder pad grid for creating custom circuits on an Arduino Mega. Working (last
checked on 2024-12-20) OSEPP Solderable Breadboard 3 Function: Solderable pads mimicking a
breadboard layout for permanent circuit construction. (1 Large, 2 Mini) In Use (Large); Available
(Mini x2) Audio Signal Processing Module 1 Function: Audio amplification and filtering from an
onboard microphone.<br>Power: Requires +12V DC input. Working (last verified recently) Salvaged
Hoverboard Wheels 4 Type: Brushless hub motors with integrated wheels.<br>Project Role: Primary
Drive Motor Designated as the primary drive motors for the rover.

11.0 Concluding Notes

To ensure the proper and safe use of the components listed in this report, please adhere to the
following guidelines:

- The voltage ratings provided are typical operating values. For precise specifications, including
  absolute maximums and operational ranges, always refer to the official component datasheets.
- The designation "Universal compatibility" indicates that a component is designed to work with
  multiple platforms (e.g., Arduino, Raspberry Pi, ESP32). However, successful integration is
  contingent upon using appropriate voltage levels and interface protocols for the target platform.
