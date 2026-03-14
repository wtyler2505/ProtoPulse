---
# LLM Optimization Metadata
metadata:
  document_id: hardware-components-parts-list
  document_type: technical-reference
  target_audience:
    - intermediate
    - advanced
    - developers
    - hardware-engineers
  complexity_level: advanced
  estimated_read_time: 2 minutes
  last_updated: '2025-11-05'
  version: 1.0.0
tags:
  - hardware
  - specifications
  - electronics
  - components
key_entities:
  - 'Arduino Mega 2560: Main microcontroller for motor control'
  - 'NodeMCU ESP8266: WiFi communication bridge'
  - 'NodeMCU ESP8266: WiFi communication bridge'
  - 'Google Gemini API: AI service integration'
  - 'Eve: AI assistant personality system'
  - 'Motor Control: PWM-based rover movement system'
summary: Technical documentation for OmniTrek Nexus project.
depends_on:
  - README.md
---

OmniTrek Rover Project Documentation

Overview

This document provides a comprehensive, structured list of all hardware and electronic components
used in the OmniTrek Rover Project. Its purpose is to offer clear, detailed information, suitable
for reference, collaboration, or sharing with AI assistants (Gemini, Claude, ChatGPT) and other
collaborators. All necessary specifications, recommended model numbers, and relevant resource links
are provided to ensure clarity, usability, and completeness.

---

Electronics and Control Systems

1\. Microcontrollers

    •	NodeMCU Amica (ESP8266)

    •	Description: Wi-Fi-enabled microcontroller for remote control and communication.

    •	Module: ESP-12E

    •	Operating Voltage: 3.3V

    •	[Reference Link](https://www.amazon.com/HiLetgo-Internet-Development-Wireless-Micropython/dp/B010O1G1ES)

    •	Arduino Mega 2560

    •	Description: Main microcontroller managing sensor inputs, motor outputs, and peripheral communication.

    •	Microcontroller Chip: ATmega2560

    •	Operating Voltage: 5V

    •	Digital I/O Pins: 54 (15 PWM)

    •	[Official Arduino Documentation](https://store.arduino.cc/products/arduino-mega-2560-rev3)

2\. Motor Controllers

    •	RioRand High Voltage Motor Controllers (4 units)

    •	Description: Dual-channel, high-current DC motor drivers with integrated support for Hall sensor feedback.

    •	Operating Voltage: Up to 36V DC

    •	Peak Current: 30A

    •	Hall Sensor Compatibility: Required for accurate control of brushless hub motors.

    •	[Example Link](https://www.amazon.com/RioRand-Controller-Motor-Driver-Module/dp/B00LW15F42)

3\. Motors and Wheels

    •	Hoverboard Brushless Hub Motors (4 units)

    •	Power: 350W each

    •	Voltage Rating: 36V DC

    •	Hall Sensor Integration: Embedded Hall sensors for precise rotor position feedback, essential for use with RioRand controllers.

    •	Source: Salvaged from hoverboards

4\. Power Supply

    •	Primary Battery (Motors)

    •	Model: HY-SSY-1002ULS

    •	Voltage/Capacity: 36V, 4000mAh Li-ion

    •	Application: Motor power supply

    •	Secondary Battery (Electronics)

    •	Model: ELITOP-702US-HY

    •	Voltage/Capacity: 25.2V, 4000mAh Li-ion

    •	Application: Electronics power supply

    •	DC-DC Step-Down Converters

    •	Model: LM2596

    •	Adjustable Output: 5V \- 12V

    •	Application: Voltage regulation for electronics

    •	[Example Link](https://www.amazon.com/Adjustable-Converter-Regulator-Step-down-Transformer/dp/B08C2KFYP2)

---

Rover Control Laptop

    •	HP Pavilion 15-n210dx

    •	Processor: AMD A8-4555M Quad-Core

    •	Graphics: AMD Radeon HD 7600G discrete-class

    •	Memory: 4GB DDR3L (expandable to 16GB)

    •	Storage: 750GB HDD

    •	Display: 15.6-inch HD touchscreen, 1366x768 resolution

    •	Connectivity: USB 3.0, USB 2.0, HDMI, RJ-45 (LAN), headphone/microphone combo

    •	Wireless: 802.11b/g/n

    •	Operating System: Windows 8.1 (upgradeable)

    •	Other: Multi-format DVD±RW drive

---

Frame and Structural Components

    •	Main Chassis

    •	Material: Salvaged hoverboard metal frames (2 units)

    •	Characteristics: Durable, balanced platform

    •	Aluminum Extrusions (Optional)

    •	Type: 20x20 mm T-slot profiles

    •	Use: Modular attachment points

    •	Laptop Mount

    •	Type: Metal/plastic adjustable stand

    •	Features: Secure, vibration-resistant mount

    •	Vibration Damping

    •	Material: Rubber or silicone pads

    •	Purpose: Protect electronics and improve stability

---

(Sections for Fasteners, Electrical Connectors, Wiring, Optional Sensors, Miscellaneous Accessories,
and Tools and Assembly Supplies remain unchanged)

---

Note: Clearly label and secure all connections to ensure safety, ease of maintenance, and effective
troubleshooting.
