### **Document Set 29: TDY 50 AC Synchronous Motor**

#### **1. Part Identification and Overview**
*   **Part Name:** AC Synchronous Motor.
*   **Manufacturer:** Shenzhen Comix Business Machine Co. Ltd.
*   **Model/Part Number:** TDY 50.
*   **Component Type:** AC Motor.
*   **Function:** This motor provides low-speed, constant rotational motion for applications where precise timing and speed are critical. Unlike standard AC induction motors, a synchronous motor's rotor speed is directly proportional to the supply frequency.

#### **2. Detailed Technical Specifications**
*   **Motor Type:** Synchronous Motor.
*   **Operating Voltage:** 100-120V AC.
*   **Frequency:** 50/60Hz.
*   **Power Consumption:** 4W.
*   **Rotational Speed:** 6 RPM (Revolutions Per Minute).
*   **Manufacturer:** Shenzhen Comix Business Machine Co. Ltd.
*   **Date Code:** 20191209.

#### **3. Functional Analysis and Operating Principles**
A synchronous motor operates on the principle that the rotor's rotational speed is synchronized with the frequency of the AC power supply. The stator windings create a rotating magnetic field whose speed (synchronous speed) is determined by the AC frequency and the number of poles in the motor. The rotor contains permanent magnets or uses a reluctance mechanism, which locks onto this rotating magnetic field. As long as the motor is supplied with AC power, the rotor will maintain its synchronous speed. The TDY 50 model has an internal reduction gearbox (geared motor) which reduces the high-speed synchronous rotation to the slow output speed of 6 RPM. The motor is self-starting due to its design.

#### **4. Application Context and Integration**
*   **Primary Applications:** Timing devices (e.g., timers in appliances), rotating displays, stage lighting effects, automatic turn tables (e.g., for a microwave oven or display), and low-speed, high-torque industrial automation requiring precise speed.
*   **Integration:** The motor requires direct connection to a 100-120V AC power source. The two lead wires connect directly to the AC lines. Due to its AC operation, it cannot be easily controlled by low-voltage DC microcontrollers like an Arduino without a relay or solid-state switch.

#### **5. Troubleshooting and Maintenance**
*   **Common Failure Modes:**
    *   **Overheating:** Running the motor at excessive load for prolonged periods can cause the internal components to overheat and fail.
    *   **Gearbox Failure:** The internal gearbox can strip if subjected to excessive force or a locked rotor condition.
    *   **Electrical Failure:** The windings can burn out if exposed to overvoltage or a short circuit.
*   **Diagnosis:** If the motor fails to turn when power is applied, first verify the AC voltage supply. If voltage is present, check for physical obstruction or internal component failure. Due to its AC nature, caution must be exercised during troubleshooting.

***

