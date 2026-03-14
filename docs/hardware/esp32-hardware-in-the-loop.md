# ESP32 Hardware-in-the-Loop Integration

Real-time ESP32 pin voltage monitoring for circuit simulation validation.

## Overview

The ESP32 Pin Monitor allows you to compare **simulated circuit voltages** (CircuitJS1) with **real
hardware voltages** (ESP32 ADC) side-by-side. Perfect for validating circuit designs before building
hardware.

## Features

- **Real-time Monitoring**: WebSocket connection for live voltage updates (50ms sample rate)
- **Multi-Pin Support**: Monitor up to 6 ADC1 pins simultaneously (GPIO 32-39)
- **Auto-Reconnect**: Automatic reconnection with exponential backoff (max 10 retries)
- **Visual Feedback**: Color-coded connection status and voltage displays
- **Timestamp Tracking**: Age indicators for each reading (ms/s/m)
- **12-bit ADC**: Full 0-3.3V range with 0.001V resolution

## Quick Start

### 1. Upload ESP32 Firmware

```bash
# Navigate to firmware directory
cd firmware/examples/

# Open esp32_voltage_websocket.ino in Arduino IDE
# Configure Wi-Fi credentials (lines 29-30)
# Upload to ESP32
```

**Configuration:**

```cpp
// Update these with your network
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Monitored pins (ADC1 only: GPIO 32-39)
const int MONITORED_PINS[] = {32, 33, 34, 35, 36, 39};
```

### 2. Connect to OmniTrek

1. Open **Circuit Simulator** in OmniTrek
2. Click **🔌 Show ESP32** button in toolbar
3. Enter WebSocket URL: `ws://<ESP32_IP>:80/ws`
   - Find IP in Arduino Serial Monitor on startup
   - Example: `ws://192.168.1.100:80/ws`
4. Click **Connect**

### 3. Monitor Voltages

- **GPIO pins**: Display real-time voltages (0-3.3V)
- **Sample rate**: 50ms (20Hz updates)
- **Age indicators**: Show data freshness (123ms, 1.5s, 2.1m)
- **Auto-reconnect**: Enabled by default (max 10 retries)

## Hardware Setup

### ESP32 Pinout (ADC1 Channels)

| GPIO | ADC1 Channel | Max Voltage |
| ---- | ------------ | ----------- |
| 32   | ADC1_CH4     | 3.3V        |
| 33   | ADC1_CH5     | 3.3V        |
| 34   | ADC1_CH6     | 3.3V        |
| 35   | ADC1_CH7     | 3.3V        |
| 36   | ADC1_CH0     | 3.3V        |
| 39   | ADC1_CH3     | 3.3V        |

**⚠️ CRITICAL: ADC2 pins (GPIO 0, 2, 4, 12-15, 25-27) are INCOMPATIBLE with Wi-Fi!**

### Voltage Divider for Higher Voltages

For voltages >3.3V, use a voltage divider:

```
Vin ---[R1]---+---[R2]--- GND
              |
           GPIO Pin

Vout = Vin × (R2 / (R1 + R2))
```

**Example (12V → 3.3V):**

- R1 = 8.2kΩ
- R2 = 3.3kΩ
- Vout = 12V × (3.3 / 11.5) = 3.44V ✓

## Use Cases

### 1. Circuit Design Validation

**Scenario:** Designed a motor driver circuit in CircuitJS1

1. Build circuit in CircuitJS1 simulator
2. Export schematic
3. Build physical prototype
4. Connect ESP32 to test points
5. Compare simulated vs real voltages
6. Identify design issues (voltage drops, oscillations, etc.)

### 2. Sensor Calibration

**Scenario:** Calibrating analog sensors

1. Simulate sensor circuit (voltage divider, op-amp, etc.)
2. Connect real sensor to ESP32
3. Apply known inputs (reference voltages)
4. Compare simulation predictions vs actual readings
5. Adjust circuit parameters in simulation
6. Verify calibration accuracy

### 3. Power Supply Testing

**Scenario:** Validating power supply ripple and regulation

1. Simulate power supply (LDO, buck converter, etc.)
2. Monitor output voltage on ESP32
3. Compare ripple characteristics
4. Validate load regulation
5. Identify noise sources

## WebSocket Protocol

### Client → ESP32

```json
{
  "type": "get_config"
}
```

### ESP32 → Client

**Configuration Response:**

```json
{
  "type": "config",
  "pins": [32, 33, 34, 35, 36, 39],
  "sample_rate_ms": 50,
  "adc_resolution": 12
}
```

**Voltage Update (20Hz):**

```json
{
  "type": "voltage_update",
  "timestamp": 123456,
  "pins": {
    "32": 1.234,
    "33": 2.456,
    "34": 0.789
  }
}
```

## Troubleshooting

### Connection Issues

**Problem:** "Error connecting to ESP32"

**Solutions:**

1. Verify ESP32 is on same network as computer
2. Check WebSocket URL format: `ws://IP:80/ws` (not http://)
3. Verify ESP32 Serial Monitor shows "WebSocket server started"
4. Test ESP32 IP with browser: `http://<ESP32_IP>` (should timeout, not refuse)
5. Check firewall settings (allow port 80)

### No Voltage Data

**Problem:** Connected but no voltages displayed

**Solutions:**

1. Check Serial Monitor for voltage readings
2. Verify pins are connected to voltage sources (0-3.3V)
3. Ensure using ADC1 pins only (32-39)
4. Check firmware MONITORED_PINS array matches your setup
5. Verify ADC attenuation: `analogSetAttenuation(ADC_11db)` for 0-3.3V

### Incorrect Voltages

**Problem:** Readings don't match expected values

**Solutions:**

1. Calibrate ESP32 ADC (ESP32 ADC is non-linear, especially at extremes)
2. Use lookup table for linearization if precision required
3. Verify voltage divider calculations for >3.3V inputs
4. Check for noise on ADC input (add 0.1µF capacitor to ground)
5. Average multiple readings in firmware if needed

### Auto-Reconnect Loops

**Problem:** Keeps reconnecting repeatedly

**Solutions:**

1. Check ESP32 Serial Monitor for crash/restart messages
2. Verify ESP32 has stable power supply (brownout detection)
3. Disable auto-reconnect temporarily to debug
4. Check WebSocket URL for typos
5. Update ESP32 firmware to latest version

## Performance

### Sample Rates

| Rate         | Use Case                            |
| ------------ | ----------------------------------- |
| 50ms (20Hz)  | Default - DC voltages, slow signals |
| 20ms (50Hz)  | Audio signals, PWM analysis         |
| 10ms (100Hz) | Fast transients, switching circuits |

**To change sample rate:** Edit `SAMPLE_RATE_MS` in firmware (line 37)

### Network Latency

- **Local Wi-Fi**: 10-20ms typical
- **Congested network**: 50-100ms
- **Total delay**: Sample rate + network latency + rendering (~70-120ms)

### ADC Accuracy

- **Resolution**: 12-bit (0-4095)
- **Voltage resolution**: 3.3V / 4096 = 0.0008V (0.8mV)
- **Non-linearity**: ±2% typical (worse at 0V and 3.3V extremes)
- **Sample rate**: Up to 1MHz (limited by WebSocket to ~100Hz practical)

## Advanced Configuration

### Custom Pin Configuration

Edit firmware (lines 33-34):

```cpp
const int MONITORED_PINS[] = {32, 33, 34};  // Only 3 pins
const int NUM_PINS = 3;
```

### Higher Sample Rates

Edit firmware (line 37):

```cpp
const unsigned long SAMPLE_RATE_MS = 10;  // 100Hz
```

**⚠️ Warning:** Sample rates <20ms may overload WebSocket bandwidth

### Voltage Divider Auto-Scaling

Add scaling factors to firmware:

```cpp
const float PIN_SCALE[] = {1.0, 1.0, 3.64, 1.0, 1.0, 1.0};  // GPIO 34 scaled for 12V

// In readPinVoltage():
float voltage = (rawValue / (float)ADC_MAX_VALUE) * ADC_VREF;
return voltage * PIN_SCALE[pinIndex];
```

## Dependencies

### ESP32 Firmware

- **ESPAsyncWebServer**: https://github.com/me-no-dev/ESPAsyncWebServer
- **AsyncTCP**: https://github.com/me-no-dev/AsyncTCP
- **ArduinoJson**: Bundled with Arduino IDE

### OmniTrek Frontend

- React 19.2+
- WebSocket API (browser native)
- TypeScript 5.8+

## File Locations

```
firmware/examples/esp32_voltage_websocket.ino   - ESP32 firmware
components/FirmwareEditor/ESP32PinMonitor.tsx   - React component
components/FirmwareEditor/CircuitSimulatorPanel.tsx - Integration
```

## References

- ESP32 ADC Characteristics:
  https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/adc.html
- CircuitJS1 Documentation: https://github.com/pfalstad/circuitjs1
- WebSocket Protocol: https://datatracker.ietf.org/doc/html/rfc6455

## License

MIT License - See project LICENSE file

## Support

For issues or questions:

- GitHub Issues: https://github.com/yourusername/OmniTrek-Nexus/issues
- Circuit questions → CircuitJS1 community
- ESP32 questions → ESP32 forums
