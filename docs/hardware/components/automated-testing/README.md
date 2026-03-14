---
# LLM Optimization Metadata
metadata:
  document_id: hardware-components-automated-testing-README
  document_type: technical-reference
  target_audience:
    - intermediate
    - advanced
    - developers
    - hardware-engineers
  complexity_level: advanced
  estimated_read_time: 20 minutes
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
  - 'ZSX11H Motor Controllers: 36V, 350W brushless motor controllers'
  - 'Eve: AI assistant personality system'
  - 'Motor Control: PWM-based rover movement system'
summary:
  '> Comprehensive testing framework for OmniTrek rover component validation This directory contains
  automated testing procedures and scripts for validating the functionality, performance, and
  reliabi...'
depends_on:
  - README.md
---

# Automated Testing Procedures

> Comprehensive testing framework for OmniTrek rover component validation

## 📋 Overview

This directory contains automated testing procedures and scripts for validating the functionality,
performance, and reliability of all hardware components used in the OmniTrek Rover project.

## 🎯 Testing Objectives

### **Functional Testing**

- Verify basic component functionality
- Test communication interfaces
- Validate sensor accuracy and response
- Check motor control precision

### **Performance Testing**

- Measure response times and latency
- Test under various load conditions
- Validate power consumption specifications
- Assess thermal performance

### **Reliability Testing**

- Long-term operation stability
- Environmental stress testing
- Component lifecycle validation
- Failure mode analysis

### **Integration Testing**

- Multi-component interaction
- System-level performance
- Communication protocol validation
- Power system integration

## 🗂️ Test Suite Structure

```text
automated-testing/
├── README.md                           # This file
├── test-framework/                     # Testing infrastructure
│   ├── test-runner.py                  # Main test execution script
│   ├── hardware-interface.py           # Component communication
│   ├── data-logger.py                  # Test result logging
│   └── report-generator.py             # Test report creation
├── component-tests/                    # Individual component tests
│   ├── microcontrollers/               # Arduino, ESP32, Pi tests
│   ├── motor-drivers/                  # Motor controller tests
│   ├── sensors/                        # Sensor validation tests
│   ├── communication/                  # Network and interface tests
│   └── power-system/                   # Power system tests
├── integration-tests/                  # Multi-component tests
│   ├── motor-control-loop/             # Motor-sensor integration
│   ├── communication-chain/            # Data flow validation
│   └── power-distribution/             # Power system integration
├── performance-tests/                  # Stress and benchmark tests
│   ├── thermal-testing/                # Heat dissipation tests
│   ├── load-testing/                   # Performance under load
│   └── endurance-testing/              # Long-term reliability
├── test-data/                          # Test results and logs
│   ├── results/                        # Individual test results
│   ├── reports/                        # Generated test reports
│   └── benchmarks/                     # Performance baselines
└── scripts/                            # Utility and setup scripts
    ├── setup-test-environment.py       # Test environment preparation
    ├── calibrate-sensors.py            # Sensor calibration routines
    └── generate-test-report.py         # Report generation utility
```

## 🔧 Test Framework Architecture

### **Core Components**

#### **Test Runner**

```python
#!/usr/bin/env python3
"""
OmniTrek Component Test Runner
Main execution engine for automated testing
"""

import time
import logging
import json
from datetime import datetime
from pathlib import Path

class TestRunner:
    def __init__(self, config_file="test-config.json"):
        self.config = self.load_config(config_file)
        self.logger = self.setup_logging()
        self.results = {}
        self.test_start_time = None

    def load_config(self, config_file):
        """Load test configuration from JSON file"""
        with open(config_file, 'r') as f:
            return json.load(f)

    def setup_logging(self):
        """Configure logging for test execution"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('test-execution.log'),
                logging.StreamHandler()
            ]
        )
        return logging.getLogger(__name__)

    def run_test_suite(self, suite_name):
        """Execute a complete test suite"""
        self.logger.info(f"Starting test suite: {suite_name}")
        self.test_start_time = datetime.now()

        try:
            suite_results = self.execute_tests(suite_name)
            self.results[suite_name] = suite_results

            # Generate report
            self.generate_report(suite_name, suite_results)

            return suite_results

        except Exception as e:
            self.logger.error(f"Test suite failed: {e}")
            return {"status": "FAILED", "error": str(e)}

    def execute_tests(self, suite_name):
        """Execute individual tests in a suite"""
        tests = self.config['test_suites'][suite_name]['tests']
        results = {}

        for test_name in tests:
            self.logger.info(f"Executing test: {test_name}")

            try:
                test_result = self.run_single_test(test_name)
                results[test_name] = test_result

                if test_result['status'] == 'FAILED':
                    self.logger.warning(f"Test failed: {test_name}")
                else:
                    self.logger.info(f"Test passed: {test_name}")

            except Exception as e:
                self.logger.error(f"Test error: {test_name} - {e}")
                results[test_name] = {
                    "status": "ERROR",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }

        return results

    def run_single_test(self, test_name):
        """Execute a single test case"""
        test_config = self.config['tests'][test_name]
        test_module = __import__(f"component_tests.{test_config['module']}",
                                fromlist=[test_config['class']])
        test_class = getattr(test_module, test_config['class'])

        # Initialize test
        test_instance = test_class(test_config.get('parameters', {}))

        # Run test
        start_time = time.time()
        result = test_instance.run_test()
        end_time = time.time()

        result['execution_time'] = end_time - start_time
        result['timestamp'] = datetime.now().isoformat()

        return result

if __name__ == "__main__":
    runner = TestRunner()

    # Run all test suites
    for suite in runner.config['test_suites'].keys():
        runner.run_test_suite(suite)

    print("All tests completed!")
```

#### **Hardware Interface**

```python
#!/usr/bin/env python3
"""
Hardware Interface Module
Provides communication with rover components
"""

import serial
import time
import smbus
import requests
from abc import ABC, abstractmethod

class HardwareInterface(ABC):
    """Abstract base class for hardware interfaces"""

    @abstractmethod
    def connect(self):
        """Establish connection to hardware"""
        pass

    @abstractmethod
    def disconnect(self):
        """Close connection to hardware"""
        pass

    @abstractmethod
    def send_command(self, command):
        """Send command to hardware"""
        pass

    @abstractmethod
    def read_response(self):
        """Read response from hardware"""
        pass

class SerialInterface(HardwareInterface):
    """Serial communication interface"""

    def __init__(self, port, baudrate=115200, timeout=5):
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.connection = None

    def connect(self):
        """Open serial connection"""
        try:
            self.connection = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=self.timeout
            )
            time.sleep(2)  # Wait for connection to stabilize
            return True
        except Exception as e:
            print(f"Serial connection failed: {e}")
            return False

    def disconnect(self):
        """Close serial connection"""
        if self.connection and self.connection.is_open:
            self.connection.close()

    def send_command(self, command):
        """Send command via serial"""
        if self.connection and self.connection.is_open:
            self.connection.write((command + '\n').encode())
            self.connection.flush()
            return True
        return False

    def read_response(self):
        """Read response from serial"""
        if self.connection and self.connection.is_open:
            response = self.connection.readline().decode().strip()
            return response
        return None

class I2CInterface(HardwareInterface):
    """I2C communication interface"""

    def __init__(self, bus_number=1):
        self.bus_number = bus_number
        self.bus = None

    def connect(self):
        """Initialize I2C bus"""
        try:
            self.bus = smbus.SMBus(self.bus_number)
            return True
        except Exception as e:
            print(f"I2C connection failed: {e}")
            return False

    def disconnect(self):
        """Close I2C bus"""
        if self.bus:
            self.bus.close()

    def send_command(self, device_address, register, data):
        """Write data to I2C device"""
        if self.bus:
            try:
                self.bus.write_byte_data(device_address, register, data)
                return True
            except Exception as e:
                print(f"I2C write failed: {e}")
                return False
        return False

    def read_response(self, device_address, register, length=1):
        """Read data from I2C device"""
        if self.bus:
            try:
                if length == 1:
                    return self.bus.read_byte_data(device_address, register)
                else:
                    return self.bus.read_i2c_block_data(device_address, register, length)
            except Exception as e:
                print(f"I2C read failed: {e}")
                return None
        return None

class HTTPInterface(HardwareInterface):
    """HTTP/REST communication interface"""

    def __init__(self, base_url, timeout=10):
        self.base_url = base_url
        self.timeout = timeout
        self.session = requests.Session()

    def connect(self):
        """Test HTTP connection"""
        try:
            response = self.session.get(f"{self.base_url}/status", timeout=self.timeout)
            return response.status_code == 200
        except Exception as e:
            print(f"HTTP connection failed: {e}")
            return False

    def disconnect(self):
        """Close HTTP session"""
        self.session.close()

    def send_command(self, endpoint, data=None):
        """Send HTTP request"""
        try:
            if data:
                response = self.session.post(f"{self.base_url}/{endpoint}",
                                           json=data, timeout=self.timeout)
            else:
                response = self.session.get(f"{self.base_url}/{endpoint}",
                                          timeout=self.timeout)
            return response.json() if response.status_code == 200 else None
        except Exception as e:
            print(f"HTTP request failed: {e}")
            return None

    def read_response(self, endpoint):
        """Read HTTP response"""
        return self.send_command(endpoint)

class ComponentTester:
    """Base class for component testing"""

    def __init__(self, config):
        self.config = config
        self.interface = None
        self.test_results = []

    def setup_interface(self, interface_type, **kwargs):
        """Setup hardware interface"""
        if interface_type == "serial":
            self.interface = SerialInterface(**kwargs)
        elif interface_type == "i2c":
            self.interface = I2CInterface(**kwargs)
        elif interface_type == "http":
            self.interface = HTTPInterface(**kwargs)
        else:
            raise ValueError(f"Unknown interface type: {interface_type}")

        return self.interface.connect()

    def log_result(self, test_name, status, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "status": status,
            "timestamp": time.time(),
            "details": details
        }
        self.test_results.append(result)
        return result

    def run_test(self):
        """Run the complete test suite"""
        raise NotImplementedError("Subclasses must implement run_test()")
```

## 📊 Test Categories

### **1. Microcontroller Tests**

#### **Arduino Mega 2560 Test Suite**

```python
#!/usr/bin/env python3
"""
Arduino Mega 2560 Test Suite
Tests main controller functionality
"""

import time
from hardware_interface import SerialInterface, ComponentTester

class ArduinoMegaTester(ComponentTester):
    def __init__(self, config):
        super().__init__(config)
        self.serial_port = config.get('serial_port', '/dev/ttyACM0')

    def run_test(self):
        """Run Arduino Mega test suite"""
        if not self.setup_interface("serial", port=self.serial_port):
            return self.log_result("connection", "FAILED", "Serial connection failed")

        results = {
            "connection": self.test_connection(),
            "digital_io": self.test_digital_io(),
            "analog_input": self.test_analog_input(),
            "pwm_output": self.test_pwm_output(),
            "motor_control": self.test_motor_control(),
            "sensor_communication": self.test_sensor_communication()
        }

        self.interface.disconnect()

        # Calculate overall status
        passed = sum(1 for r in results.values() if r["status"] == "PASSED")
        total = len(results)

        return {
            "status": "PASSED" if passed == total else "FAILED",
            "summary": f"{passed}/{total} tests passed",
            "details": results
        }

    def test_connection(self):
        """Test basic serial communication"""
        try:
            # Send ping command
            self.interface.send_command("PING")
            response = self.interface.read_response()

            if response == "PONG":
                return self.log_result("basic_communication", "PASSED", "Ping-pong successful")
            else:
                return self.log_result("basic_communication", "FAILED", f"Unexpected response: {response}")

        except Exception as e:
            return self.log_result("basic_communication", "FAILED", str(e))

    def test_digital_io(self):
        """Test digital input/output pins"""
        try:
            # Test LED pin (13)
            self.interface.send_command("SET_PIN:13:HIGH")
            time.sleep(0.1)
            response = self.interface.read_response()

            if "PIN_SET" in response:
                self.interface.send_command("SET_PIN:13:LOW")
                response = self.interface.read_response()

                if "PIN_SET" in response:
                    return self.log_result("digital_io", "PASSED", "Digital I/O working")
                else:
                    return self.log_result("digital_io", "FAILED", "LED turn off failed")
            else:
                return self.log_result("digital_io", "FAILED", "LED turn on failed")

        except Exception as e:
            return self.log_result("digital_io", "FAILED", str(e))

    def test_analog_input(self):
        """Test analog input functionality"""
        try:
            self.interface.send_command("READ_ANALOG:A0")
            response = self.interface.read_response()

            if response and response.startswith("ANALOG:"):
                value = int(response.split(":")[1])
                if 0 <= value <= 1023:
                    return self.log_result("analog_input", "PASSED", f"Analog value: {value}")
                else:
                    return self.log_result("analog_input", "FAILED", f"Invalid analog value: {value}")
            else:
                return self.log_result("analog_input", "FAILED", "No analog response")

        except Exception as e:
            return self.log_result("analog_input", "FAILED", str(e))

    def test_pwm_output(self):
        """Test PWM output functionality"""
        try:
            # Test PWM on pin 9
            test_values = [64, 128, 192, 255]

            for pwm_value in test_values:
                self.interface.send_command(f"SET_PWM:9:{pwm_value}")
                response = self.interface.read_response()

                if "PWM_SET" not in response:
                    return self.log_result("pwm_output", "FAILED", f"PWM {pwm_value} failed")

                time.sleep(0.1)

            return self.log_result("pwm_output", "PASSED", "PWM output working")

        except Exception as e:
            return self.log_result("pwm_output", "FAILED", str(e))

    def test_motor_control(self):
        """Test motor controller interface"""
        try:
            # Test motor direction control
            self.interface.send_command("SET_MOTOR:FL:FORWARD:128")
            response = self.interface.read_response()

            if "MOTOR_SET" in response:
                time.sleep(1)

                self.interface.send_command("SET_MOTOR:FL:STOP")
                response = self.interface.read_response()

                if "MOTOR_SET" in response:
                    return self.log_result("motor_control", "PASSED", "Motor control working")
                else:
                    return self.log_result("motor_control", "FAILED", "Motor stop failed")
            else:
                return self.log_result("motor_control", "FAILED", "Motor start failed")

        except Exception as e:
            return self.log_result("motor_control", "FAILED", str(e))

    def test_sensor_communication(self):
        """Test sensor I2C communication"""
        try:
            # Test MPU-6050 communication
            self.interface.send_command("READ_MPU")
            response = self.interface.read_response()

            if response and response.startswith("MPU_DATA:"):
                return self.log_result("sensor_communication", "PASSED", "MPU-6050 communication working")
            else:
                return self.log_result("sensor_communication", "FAILED", "MPU-6050 communication failed")

        except Exception as e:
            return self.log_result("sensor_communication", "FAILED", str(e))
```

#### **ESP-32S Test Suite**

```python
#!/usr/bin/env python3
"""
NodeMCU ESP-32S Test Suite
Tests WiFi and communication module
"""

import time
import requests
from hardware_interface import HTTPInterface, ComponentTester

class ESP32STester(ComponentTester):
    def __init__(self, config):
        super().__init__(config)
        self.ip_address = config.get('ip_address', '192.168.1.100')
        self.port = config.get('port', 80)

    def run_test(self):
        """Run ESP-32S test suite"""
        base_url = f"http://{self.ip_address}:{self.port}"

        if not self.setup_interface("http", base_url=base_url):
            return self.log_result("connection", "FAILED", "HTTP connection failed")

        results = {
            "web_server": self.test_web_server(),
            "wifi_status": self.test_wifi_status(),
            "gpio_control": self.test_gpio_control(),
            "sensor_interface": self.test_sensor_interface(),
            "arduino_communication": self.test_arduino_communication(),
            "performance": self.test_performance()
        }

        self.interface.disconnect()

        # Calculate overall status
        passed = sum(1 for r in results.values() if r["status"] == "PASSED")
        total = len(results)

        return {
            "status": "PASSED" if passed == total else "FAILED",
            "summary": f"{passed}/{total} tests passed",
            "details": results
        }

    def test_web_server(self):
        """Test web server functionality"""
        try:
            response = self.interface.send_command("status")

            if response and "esp32" in response.get("device", "").lower():
                return self.log_result("web_server", "PASSED", "Web server responding")
            else:
                return self.log_result("web_server", "FAILED", "Invalid status response")

        except Exception as e:
            return self.log_result("web_server", "FAILED", str(e))

    def test_wifi_status(self):
        """Test WiFi connectivity"""
        try:
            response = self.interface.send_command("wifi")

            if response and response.get("connected", False):
                signal_strength = response.get("rssi", 0)
                if signal_strength > -70:  # Good signal threshold
                    return self.log_result("wifi_status", "PASSED", f"WiFi connected, RSSI: {signal_strength}")
                else:
                    return self.log_result("wifi_status", "FAILED", f"Weak WiFi signal: {signal_strength}")
            else:
                return self.log_result("wifi_status", "FAILED", "WiFi not connected")

        except Exception as e:
            return self.log_result("wifi_status", "FAILED", str(e))

    def test_gpio_control(self):
        """Test GPIO control functionality"""
        try:
            # Test built-in LED control
            response = self.interface.send_command("gpio/2", {"state": "high"})

            if response and response.get("success", False):
                time.sleep(0.5)

                response = self.interface.send_command("gpio/2", {"state": "low"})

                if response and response.get("success", False):
                    return self.log_result("gpio_control", "PASSED", "GPIO control working")
                else:
                    return self.log_result("gpio_control", "FAILED", "LED turn off failed")
            else:
                return self.log_result("gpio_control", "FAILED", "LED turn on failed")

        except Exception as e:
            return self.log_result("gpio_control", "FAILED", str(e))

    def test_sensor_interface(self):
        """Test sensor interface capabilities"""
        try:
            # Test analog reading
            response = self.interface.send_command("sensor/analog/32")

            if response and "value" in response:
                value = response["value"]
                if 0 <= value <= 4095:  # 12-bit ADC range
                    return self.log_result("sensor_interface", "PASSED", f"Analog read: {value}")
                else:
                    return self.log_result("sensor_interface", "FAILED", f"Invalid analog value: {value}")
            else:
                return self.log_result("sensor_interface", "FAILED", "No analog response")

        except Exception as e:
            return self.log_result("sensor_interface", "FAILED", str(e))

    def test_arduino_communication(self):
        """Test Arduino communication interface"""
        try:
            # Send test command to Arduino
            response = self.interface.send_command("arduino/send", {"command": "PING"})

            if response and response.get("success", False):
                return self.log_result("arduino_communication", "PASSED", "Arduino communication working")
            else:
                return self.log_result("arduino_communication", "FAILED", "Arduino communication failed")

        except Exception as e:
            return self.log_result("arduino_communication", "FAILED", str(e))

    def test_performance(self):
        """Test ESP-32S performance metrics"""
        try:
            start_time = time.time()

            # Make multiple requests to test response time
            for _ in range(10):
                self.interface.send_command("status")

            end_time = time.time()
            avg_response_time = (end_time - start_time) / 10

            if avg_response_time < 0.1:  # 100ms threshold
                return self.log_result("performance", "PASSED", f"Avg response: {avg_response_time:.3f}s")
            else:
                return self.log_result("performance", "FAILED", f"Slow response: {avg_response_time:.3f}s")

        except Exception as e:
            return self.log_result("performance", "FAILED", str(e))
```

### **2. Motor Driver Tests**

#### **ZS-X11H Motor Controller Test**

```python
#!/usr/bin/env python3
"""
RioRand ZS-X11H Motor Controller Test Suite
Tests BLDC motor controller functionality
"""

import time
from hardware_interface import SerialInterface, ComponentTester

class ZSX11HTester(ComponentTester):
    def __init__(self, config):
        super().__init__(config)
        self.serial_port = config.get('serial_port', '/dev/ttyACM0')
        self.motor_id = config.get('motor_id', 'FL')

    def run_test(self):
        """Run ZS-X11H test suite"""
        if not self.setup_interface("serial", port=self.serial_port):
            return self.log_result("connection", "FAILED", "Serial connection failed")

        results = {
            "power_on": self.test_power_on(),
            "hall_sensor": self.test_hall_sensors(),
            "motor_speed": self.test_motor_speed(),
            "direction_control": self.test_direction_control(),
            "emergency_stop": self.test_emergency_stop(),
            "thermal_protection": self.test_thermal_protection()
        }

        self.interface.disconnect()

        # Calculate overall status
        passed = sum(1 for r in results.values() if r["status"] == "PASSED")
        total = len(results)

        return {
            "status": "PASSED" if passed == total else "FAILED",
            "summary": f"{passed}/{total} tests passed",
            "details": results
        }

    def test_power_on(self):
        """Test motor controller power on sequence"""
        try:
            self.interface.send_command(f"MOTOR_POWER:{self.motor_id}:ON")
            time.sleep(2)
            response = self.interface.read_response()

            if "POWER_ON" in response:
                return self.log_result("power_on", "PASSED", "Motor controller powered on")
            else:
                return self.log_result("power_on", "FAILED", "Power on failed")

        except Exception as e:
            return self.log_result("power_on", "FAILED", str(e))

    def test_hall_sensors(self):
        """Test Hall sensor functionality"""
        try:
            self.interface.send_command(f"READ_HALL:{self.motor_id}")
            response = self.interface.read_response()

            if response and response.startswith("HALL:"):
                hall_values = response.split(":")[1].split(",")
                if len(hall_values) == 3 and all(v in ['0', '1'] for v in hall_values):
                    return self.log_result("hall_sensor", "PASSED", f"Hall sensors: {hall_values}")
                else:
                    return self.log_result("hall_sensor", "FAILED", f"Invalid Hall values: {hall_values}")
            else:
                return self.log_result("hall_sensor", "FAILED", "No Hall sensor response")

        except Exception as e:
            return self.log_result("hall_sensor", "FAILED", str(e))

    def test_motor_speed(self):
        """Test motor speed control"""
        try:
            test_speeds = [50, 100, 150, 200]

            for speed in test_speeds:
                self.interface.send_command(f"SET_SPEED:{self.motor_id}:{speed}")
                time.sleep(1)

                response = self.interface.read_response()
                if "SPEED_SET" not in response:
                    return self.log_result("motor_speed", "FAILED", f"Speed {speed} failed")

            # Stop motor
            self.interface.send_command(f"SET_SPEED:{self.motor_id}:0")

            return self.log_result("motor_speed", "PASSED", "Speed control working")

        except Exception as e:
            return self.log_result("motor_speed", "FAILED", str(e))

    def test_direction_control(self):
        """Test motor direction control"""
        try:
            # Test forward direction
            self.interface.send_command(f"SET_DIRECTION:{self.motor_id}:FORWARD")
            time.sleep(0.5)
            response = self.interface.read_response()

            if "DIRECTION_SET" not in response:
                return self.log_result("direction_control", "FAILED", "Forward direction failed")

            # Test reverse direction
            self.interface.send_command(f"SET_DIRECTION:{self.motor_id}:REVERSE")
            time.sleep(0.5)
            response = self.interface.read_response()

            if "DIRECTION_SET" not in response:
                return self.log_result("direction_control", "FAILED", "Reverse direction failed")

            return self.log_result("direction_control", "PASSED", "Direction control working")

        except Exception as e:
            return self.log_result("direction_control", "FAILED", str(e))

    def test_emergency_stop(self):
        """Test emergency stop functionality"""
        try:
            # Start motor
            self.interface.send_command(f"SET_SPEED:{self.motor_id}:100")
            time.sleep(1)

            # Emergency stop
            self.interface.send_command(f"EMERGENCY_STOP:{self.motor_id}")
            response = self.interface.read_response()

            if "EMERGENCY_STOP" in response:
                return self.log_result("emergency_stop", "PASSED", "Emergency stop working")
            else:
                return self.log_result("emergency_stop", "FAILED", "Emergency stop failed")

        except Exception as e:
            return self.log_result("emergency_stop", "FAILED", str(e))

    def test_thermal_protection(self):
        """Test thermal protection functionality"""
        try:
            self.interface.send_command(f"READ_TEMP:{self.motor_id}")
            response = self.interface.read_response()

            if response and response.startswith("TEMP:"):
                temp = float(response.split(":")[1])
                if temp < 80.0:  # Normal operating temperature
                    return self.log_result("thermal_protection", "PASSED", f"Temperature: {temp}°C")
                else:
                    return self.log_result("thermal_protection", "FAILED", f"High temperature: {temp}°C")
            else:
                return self.log_result("thermal_protection", "FAILED", "No temperature response")

        except Exception as e:
            return self.log_result("thermal_protection", "FAILED", str(e))
```

### **3. Sensor Tests**

#### **MPU-6050 Motion Sensor Test**

```python
#!/usr/bin/env python3
"""
MPU-6050 Motion Sensor Test Suite
Tests 6-axis motion sensor functionality
"""

import time
import math
from hardware_interface import I2CInterface, ComponentTester

class MPU6050Tester(ComponentTester):
    def __init__(self, config):
        super().__init__(config)
        self.i2c_address = config.get('i2c_address', 0x68)
        self.bus_number = config.get('bus_number', 1)

    def run_test(self):
        """Run MPU-6050 test suite"""
        if not self.setup_interface("i2c", bus_number=self.bus_number):
            return self.log_result("connection", "FAILED", "I2C connection failed")

        results = {
            "i2c_communication": self.test_i2c_communication(),
            "sensor_id": self.test_sensor_id(),
            "accelerometer": self.test_accelerometer(),
            "gyroscope": self.test_gyroscope(),
            "temperature": self.test_temperature(),
            "data_quality": self.test_data_quality()
        }

        self.interface.disconnect()

        # Calculate overall status
        passed = sum(1 for r in results.values() if r["status"] == "PASSED")
        total = len(results)

        return {
            "status": "PASSED" if passed == total else "FAILED",
            "summary": f"{passed}/{total} tests passed",
            "details": results
        }

    def test_i2c_communication(self):
        """Test basic I2C communication"""
        try:
            # Read WHO_AM_I register
            who_am_i = self.interface.read_response(self.i2c_address, 0x75)

            if who_am_i == 0x68:  # Expected MPU-6050 ID
                return self.log_result("i2c_communication", "PASSED", f"Device ID: 0x{who_am_i:02X}")
            else:
                return self.log_result("i2c_communication", "FAILED", f"Wrong device ID: 0x{who_am_i:02X}")

        except Exception as e:
            return self.log_result("i2c_communication", "FAILED", str(e))

    def test_sensor_id(self):
        """Test sensor identification"""
        try:
            # Wake up sensor
            self.interface.send_command(self.i2c_address, 0x6B, 0x00)
            time.sleep(0.1)

            # Read WHO_AM_I again
            who_am_i = self.interface.read_response(self.i2c_address, 0x75)

            if who_am_i == 0x68:
                return self.log_result("sensor_id", "PASSED", "Sensor properly initialized")
            else:
                return self.log_result("sensor_id", "FAILED", "Sensor initialization failed")

        except Exception as e:
            return self.log_result("sensor_id", "FAILED", str(e))

    def test_accelerometer(self):
        """Test accelerometer functionality"""
        try:
            # Read accelerometer data
            accel_data = self.interface.read_response(self.i2c_address, 0x3B, 6)

            if accel_data and len(accel_data) == 6:
                # Convert to 16-bit values
                accel_x = (accel_data[0] << 8 | accel_data[1])
                accel_y = (accel_data[2] << 8 | accel_data[3])
                accel_z = (accel_data[4] << 8 | accel_data[5])

                # Convert to signed values
                if accel_x > 32767: accel_x -= 65536
                if accel_y > 32767: accel_y -= 65536
                if accel_z > 32767: accel_z -= 65536

                # Check for reasonable values (stationary sensor should read ~1g on Z axis)
                g_scale = 16384.0  # LSB/g for ±2g range
                ax = accel_x / g_scale
                ay = accel_y / g_scale
                az = accel_z / g_scale

                if 0.5 < az < 1.5 and abs(ax) < 0.5 and abs(ay) < 0.5:
                    return self.log_result("accelerometer", "PASSED", f"Accel: X={ax:.2f}g, Y={ay:.2f}g, Z={az:.2f}g")
                else:
                    return self.log_result("accelerometer", "FAILED", f"Invalid accel values: X={ax:.2f}g, Y={ay:.2f}g, Z={az:.2f}g")
            else:
                return self.log_result("accelerometer", "FAILED", "No accelerometer data")

        except Exception as e:
            return self.log_result("accelerometer", "FAILED", str(e))

    def test_gyroscope(self):
        """Test gyroscope functionality"""
        try:
            # Read gyroscope data
            gyro_data = self.interface.read_response(self.i2c_address, 0x43, 6)

            if gyro_data and len(gyro_data) == 6:
                # Convert to 16-bit values
                gyro_x = (gyro_data[0] << 8 | gyro_data[1])
                gyro_y = (gyro_data[2] << 8 | gyro_data[3])
                gyro_z = (gyro_data[4] << 8 | gyro_data[5])

                # Convert to signed values
                if gyro_x > 32767: gyro_x -= 65536
                if gyro_y > 32767: gyro_y -= 65536
                if gyro_z > 32767: gyro_z -= 65536

                # Convert to degrees/second
                gyro_scale = 131.0  # LSB/(°/s) for ±250°/s range
                gx = gyro_x / gyro_scale
                gy = gyro_y / gyro_scale
                gz = gyro_z / gyro_scale

                # Stationary sensor should have small values
                if abs(gx) < 5.0 and abs(gy) < 5.0 and abs(gz) < 5.0:
                    return self.log_result("gyroscope", "PASSED", f"Gyro: X={gx:.2f}°/s, Y={gy:.2f}°/s, Z={gz:.2f}°/s")
                else:
                    return self.log_result("gyroscope", "FAILED", f"High gyro values: X={gx:.2f}°/s, Y={gy:.2f}°/s, Z={gz:.2f}°/s")
            else:
                return self.log_result("gyroscope", "FAILED", "No gyroscope data")

        except Exception as e:
            return self.log_result("gyroscope", "FAILED", str(e))

    def test_temperature(self {
        """Test temperature sensor"""
        try:
            # Read temperature data
            temp_data = self.interface.read_response(self.i2c_address, 0x41, 2)

            if temp_data and len(temp_data) == 2:
                temp_raw = (temp_data[0] << 8 | temp_data[1])
                if temp_raw > 32767: temp_raw -= 65536

                # Convert to Celsius
                temperature = temp_raw / 340.0 + 36.53

                if 15.0 < temperature < 45.0:  # Reasonable temperature range
                    return self.log_result("temperature", "PASSED", f"Temperature: {temperature:.1f}°C")
                else:
                    return self.log_result("temperature", "FAILED", f"Invalid temperature: {temperature:.1f}°C")
            else:
                return self.log_result("temperature", "FAILED", "No temperature data")

        except Exception as e:
            return self.log_result("temperature", "FAILED", str(e))

    def test_data_quality(self):
        """Test data quality and consistency"""
        try:
            # Read multiple samples to check consistency
            samples = []
            for _ in range(10):
                accel_data = self.interface.read_response(self.i2c_address, 0x3B, 6)
                if accel_data and len(accel_data) == 6:
                    accel_z = (accel_data[4] << 8 | accel_data[5])
                    if accel_z > 32767: accel_z -= 65536
                    samples.append(accel_z)
                time.sleep(0.1)

            if len(samples) >= 5:
                # Calculate standard deviation
                mean = sum(samples) / len(samples)
                variance = sum((x - mean) ** 2 for x in samples) / len(samples)
                std_dev = math.sqrt(variance)

                if std_dev < 1000:  # Low noise threshold
                    return self.log_result("data_quality", "PASSED", f"Data stable, std dev: {std_dev:.0f}")
                else:
                    return self.log_result("data_quality", "FAILED", f"Noisy data, std dev: {std_dev:.0f}")
            else:
                return self.log_result("data_quality", "FAILED", "Insufficient data samples")

        except Exception as e:
            return self.log_result("data_quality", "FAILED", str(e))
```

## 📈 Test Execution & Reporting

### **Automated Test Scheduler**

```python
#!/usr/bin/env python3
"""
Automated Test Scheduler
Runs scheduled tests and generates reports
"""

import schedule
import time
import json
from datetime import datetime, timedelta
from test_runner import TestRunner
from report_generator import ReportGenerator

class TestScheduler:
    def __init__(self, config_file="scheduler-config.json"):
        self.config = self.load_config(config_file)
        self.test_runner = TestRunner()
        self.report_generator = ReportGenerator()

    def load_config(self, config_file):
        """Load scheduler configuration"""
        with open(config_file, 'r') as f:
            return json.load(f)

    def setup_schedule(self):
        """Setup test execution schedule"""
        # Daily health check
        schedule.every().day.at("08:00").do(self.run_daily_health_check)

        # Weekly comprehensive test
        schedule.every().sunday.at("10:00").do(self.run_weekly_comprehensive)

        # Monthly performance test
        schedule.every().month.do(self.run_monthly_performance)

        # Custom scheduled tests
        for test_config in self.config.get('custom_tests', []):
            frequency = test_config['frequency']
            time_slot = test_config['time']
            test_suite = test_config['suite']

            if frequency == 'daily':
                schedule.every().day.at(time_slot).do(self.run_custom_test, test_suite)
            elif frequency == 'weekly':
                schedule.every().week.at(time_slot).do(self.run_custom_test, test_suite)
            elif frequency == 'hourly':
                schedule.every().hour.do(self.run_custom_test, test_suite)

    def run_daily_health_check(self):
        """Run daily health check tests"""
        print(f"Running daily health check at {datetime.now()}")

        test_suites = ['arduino_mega_health', 'esp32_health', 'sensor_health']
        results = {}

        for suite in test_suites:
            try:
                results[suite] = self.test_runner.run_test_suite(suite)
            except Exception as e:
                results[suite] = {"status": "ERROR", "error": str(e)}

        # Generate daily report
        report = self.report_generator.generate_daily_report(results)
        self.send_notifications(report)

    def run_weekly_comprehensive(self):
        """Run weekly comprehensive tests"""
        print(f"Running weekly comprehensive test at {datetime.now()}")

        test_suites = [
            'arduino_mega_full', 'esp32_full', 'motor_drivers_full',
            'sensors_full', 'integration_tests'
        ]

        results = {}
        for suite in test_suites:
            try:
                results[suite] = self.test_runner.run_test_suite(suite)
            except Exception as e:
                results[suite] = {"status": "ERROR", "error": str(e)}

        # Generate weekly report
        report = self.report_generator.generate_weekly_report(results)
        self.send_notifications(report)

    def run_monthly_performance(self):
        """Run monthly performance tests"""
        print(f"Running monthly performance test at {datetime.now()}")

        test_suites = ['performance_stress', 'thermal_testing', 'endurance_testing']

        results = {}
        for suite in test_suites:
            try:
                results[suite] = self.test_runner.run_test_suite(suite)
            except Exception as e:
                results[suite] = {"status": "ERROR", "error": str(e)}

        # Generate monthly report
        report = self.report_generator.generate_monthly_report(results)
        self.send_notifications(report)

    def run_custom_test(self, test_suite):
        """Run custom scheduled test"""
        print(f"Running custom test suite: {test_suite}")

        try:
            results = self.test_runner.run_test_suite(test_suite)
            report = self.report_generator.generate_custom_report(test_suite, results)
            self.send_notifications(report)
        except Exception as e:
            print(f"Custom test failed: {e}")

    def send_notifications(self, report):
        """Send test report notifications"""
        # Email notification
        if self.config.get('email_notifications', False):
            self.send_email_report(report)

        # Slack notification
        if self.config.get('slack_notifications', False):
            self.send_slack_report(report)

        # Log to file
        self.log_report(report)

    def start_scheduler(self):
        """Start the test scheduler"""
        self.setup_schedule()
        print("Test scheduler started...")

        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute

if __name__ == "__main__":
    scheduler = TestScheduler()
    scheduler.start_scheduler()
```

### **Test Report Generator**

```python
#!/usr/bin/env python3
"""
Test Report Generator
Creates comprehensive test reports
"""

import json
import matplotlib.pyplot as plt
from datetime import datetime
from jinja2 import Template

class ReportGenerator:
    def __init__(self):
        self.report_template = self.load_template()

    def load_template(self):
        """Load HTML report template"""
        template_str = """
<!DOCTYPE html>
<html>
<head>
    <title>OmniTrek Test Report - {{ report_date }}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #ecf0f1; padding: 15px; border-radius: 5px; text-align: center; }
        .test-suite { margin: 20px 0; border: 1px solid #bdc3c7; border-radius: 5px; }
        .suite-header { background: #3498db; color: white; padding: 10px; font-weight: bold; }
        .test-result { padding: 10px; border-bottom: 1px solid #ecf0f1; }
        .passed { background: #d5f4e6; }
        .failed { background: #fadbd8; }
        .error { background: #fdebd0; }
        .chart { margin: 20px 0; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>OmniTrek Rover Test Report</h1>
        <p>Date: {{ report_date }}</p>
        <p>Test Type: {{ test_type }}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>{{ total_tests }}</h3>
            <p>Total Tests</p>
        </div>
        <div class="metric">
            <h3>{{ passed_tests }}</h3>
            <p>Passed</p>
        </div>
        <div class="metric">
            <h3>{{ failed_tests }}</h3>
            <p>Failed</p>
        </div>
        <div class="metric">
            <h3>{{ success_rate }}%</h3>
            <p>Success Rate</p>
        </div>
    </div>

    {% for suite_name, suite_results in test_results.items() %}
    <div class="test-suite">
        <div class="suite-header">{{ suite_name }}</div>
        {% for test_name, test_result in suite_results.items() %}
        <div class="test-result {{ test_result.status.lower() }}">
            <strong>{{ test_name }}</strong>: {{ test_result.status }}
            {% if test_result.details %}
            <br><small>{{ test_result.details }}</small>
            {% endif %}
        </div>
        {% endfor %}
    </div>
    {% endfor %}

    <div class="chart">
        <h3>Test Results Chart</h3>
        <img src="test_results_chart.png" alt="Test Results Chart">
    </div>
</body>
</html>
        """
        return Template(template_str)

    def generate_daily_report(self, test_results):
        """Generate daily test report"""
        report_data = self.analyze_results(test_results)

        # Generate HTML report
        html_report = self.report_template.render(
            report_date=datetime.now().strftime("%Y-%m-%d"),
            test_type="Daily Health Check",
            **report_data
        )

        # Save report
        report_filename = f"test-data/reports/daily_report_{datetime.now().strftime('%Y%m%d')}.html"
        with open(report_filename, 'w') as f:
            f.write(html_report)

        # Generate chart
        self.generate_results_chart(report_data, "test_data/reports/daily_chart.png")

        return {
            "type": "daily",
            "filename": report_filename,
            "summary": report_data
        }

    def generate_weekly_report(self, test_results):
        """Generate weekly test report"""
        report_data = self.analyze_results(test_results)

        # Generate HTML report
        html_report = self.report_template.render(
            report_date=datetime.now().strftime("%Y-%m-%d"),
            test_type="Weekly Comprehensive",
            **report_data
        )

        # Save report
        report_filename = f"test-data/reports/weekly_report_{datetime.now().strftime('%Y%m%d')}.html"
        with open(report_filename, 'w') as f:
            f.write(html_report)

        # Generate chart
        self.generate_results_chart(report_data, "test_data/reports/weekly_chart.png")

        return {
            "type": "weekly",
            "filename": report_filename,
            "summary": report_data
        }

    def analyze_results(self, test_results):
        """Analyze test results and generate metrics"""
        total_tests = 0
        passed_tests = 0
        failed_tests = 0
        error_tests = 0

        for suite_name, suite_results in test_results.items():
            for test_name, test_result in suite_results.items():
                total_tests += 1

                if test_result.get("status") == "PASSED":
                    passed_tests += 1
                elif test_result.get("status") == "FAILED":
                    failed_tests += 1
                elif test_result.get("status") == "ERROR":
                    error_tests += 1

        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0

        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "error_tests": error_tests,
            "success_rate": round(success_rate, 1),
            "test_results": test_results
        }

    def generate_results_chart(self, report_data, filename):
        """Generate test results chart"""
        labels = ['Passed', 'Failed', 'Error']
        sizes = [report_data['passed_tests'], report_data['failed_tests'], report_data['error_tests']]
        colors = ['#2ecc71', '#e74c3c', '#f39c12']

        plt.figure(figsize=(8, 6))
        plt.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
        plt.axis('equal')
        plt.title('Test Results Distribution')

        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
```

## 🚀 Getting Started

### **Prerequisites**

```bash
# Install required Python packages
pip install pyserial smbus2 requests matplotlib jinja2 schedule

# Install system dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install python3-serial i2c-tools

# Add user to dialout group for serial access
sudo usermod -a -G dialout $USER

# Enable I2C interface
sudo raspi-config  # For Raspberry Pi
# Or edit /boot/config.txt to add: dtparam=i2c_arm=on
```

### **Configuration**

```json
{
  "test_config": {
    "serial_ports": {
      "arduino_mega": "/dev/ttyACM0",
      "backup_arduino": "/dev/ttyACM1"
    },
    "i2c_addresses": {
      "mpu6050": 0x68,
      "secondary_mpu": 0x69
    },
    "network_config": {
      "esp32_ip": "192.168.1.100",
      "esp32_port": 80
    }
  },
  "test_suites": {
    "daily_health": {
      "tests": ["arduino_connection", "esp32_connection", "sensor_health", "motor_health"]
    },
    "weekly_comprehensive": {
      "tests": [
        "arduino_full_test",
        "esp32_full_test",
        "motor_driver_test",
        "sensor_calibration",
        "integration_test"
      ]
    }
  }
}
```

### **Running Tests**

```bash
# Run single test suite
python test-runner.py --suite daily_health

# Run all tests
python test-runner.py --all

# Run with custom configuration
python test-runner.py --config custom-config.json

# Start automated scheduler
python test-scheduler.py

# Generate report from existing results
python generate-test-report.py --date 2025-11-03
```

---

**Last Updated**: 2025-11-05 **Framework Version**: 1.0.0 **Language**: Python 3.8+

This automated testing framework provides comprehensive validation of all OmniTrek rover components
with detailed reporting and scheduling capabilities.
