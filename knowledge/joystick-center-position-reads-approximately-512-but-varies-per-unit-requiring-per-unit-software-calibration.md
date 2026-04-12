---
description: "The joystick spring-return mechanism settles at a slightly different resting position per unit — center reads approximately 512 on a 10-bit ADC but can drift 480-540, so code must sample center at startup for per-unit calibration rather than hardcoding 512"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[analog-joystick-module-xy-axes-plus-pushbutton]]"
---

# Joystick center position reads approximately 512 but varies per unit requiring per-unit software calibration

The spring-return gimbal's resting position is imprecise due to manufacturing tolerances in the spring tension and potentiometer track. Each unit's center reads slightly differently:

- Unit A: X=508, Y=521
- Unit B: X=518, Y=497
- Unit C: X=503, Y=530

Code that hardcodes `if (x == 512) { /* centered */ }` will interpret a resting joystick as slightly tilted. This creates phantom drift in applications like motor control or cursor movement.

**Proper calibration pattern:**
```cpp
int centerX, centerY;

void setup() {
  // Sample center at startup (joystick must be untouched)
  centerX = analogRead(X_PIN);
  centerY = analogRead(Y_PIN);
}

void loop() {
  int x = analogRead(X_PIN) - centerX;  // -512 to +511 relative
  int y = analogRead(Y_PIN) - centerY;
  
  // Dead zone around center to absorb noise + spring imprecision
  if (abs(x) < 20) x = 0;
  if (abs(y) < 20) y = 0;
}
```

The dead zone (typically 10-30 ADC counts) compensates for:
1. Spring return imprecision (doesn't land exactly on center)
2. ADC noise (±2 LSB typical)
3. Mechanical play in the gimbal

This is distinct from the endpoint dead zones at mechanical stops (covered in the potentiometer rotation range note). Center drift is a spring-return specific problem.

---

Topics:
- [[input-devices]]

Related:
- [[joystick-module-is-two-potentiometers-on-a-spring-return-gimbal-consuming-two-analog-pins-plus-one-digital-pin]]
- [[potentiometer-300-degree-rotation-range-with-mechanical-stops-means-software-must-handle-endpoint-dead-zones-in-adc-reading]]
- [[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread]]
