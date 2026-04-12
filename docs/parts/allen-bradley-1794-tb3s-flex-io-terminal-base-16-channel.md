---
description: "Industrial automation terminal base for Flex I/O modules — 16 I/O + 18 common terminals, spring clamp, DIN rail mount. 125VAC/DC 10A per terminal"
topics: ["[[communication]]"]
status: needs-test
quantity: 1
voltage: [24, 125]
interfaces: []
manufacturer: "Allen-Bradley (Rockwell)"
part_number: "1794-TB3S"
warnings: ["Industrial equipment — 125VAC rated. Observe all safety procedures", "Requires compatible 1794-series Flex I/O module to function"]
datasheet_url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHMhA8tfqhmwIGpVtvl4FssqFwdWDjrH6jhWxOVZEAW3I2UNzSxlW8aP8bRHqjXhKtMyO5t3bfNg_3uuGyWYzuJBv-wyVeCG0AnbeNj2gjCGv7wTjN7rgbdZM8I19_6BuV7ljyI2RBrFs5djLlqgMDoVBKj0d2W4r6WfFu-lyjXSw_1iA=="
datasheet_url: ""
---

# Allen-Bradley 1794-TB3S Flex I/O Terminal Base (16-Channel)

An industrial terminal base from the Allen-Bradley Flex I/O system. This is the wiring interface — the part that connects field devices (sensors, actuators, switches) to a Flex I/O module via spring-clamp terminals. It does not process signals on its own; it needs a compatible 1794-series I/O module mounted on top.

## Key Specs

| Parameter | Value |
|-----------|-------|
| Channels | 16 I/O + 18 common terminals |
| Terminal Type | Spring clamp |
| Mounting | DIN rail |
| Voltage Rating | 125VAC/DC per terminal |
| Current Rating | 10A per terminal |
| System | Allen-Bradley Flex I/O (1794 series) |
| Manufacturer | Allen-Bradley (Rockwell Automation) |
| Part Number | 1794-TB3S |

## System Context

The Flex I/O system is a modular industrial automation platform:
- **Terminal base** (this part) — provides field wiring connections
- **I/O module** (separate, required) — snaps onto the terminal base, provides signal conditioning and communication
- **Adapter** (separate, required) — connects the Flex I/O rack to a PLC or network (DeviceNet, EtherNet/IP, ControlNet)

Without a compatible 1794-series I/O module, this terminal base is just a wiring block.

## Usage Notes

- This is industrial-grade equipment rated for 125VAC — it is NOT a hobby/maker component. Follow all electrical safety procedures
- Spring clamp terminals accept 14-22 AWG wire without tools (push to insert, pull to release)
- The 16 I/O terminals map 1:1 to the I/O module channels; the 18 common terminals provide shared return paths
- If you have a compatible 1794 I/O module, this could be repurposed as a robust terminal block for high-current switching projects
- Without the I/O module, it could still serve as a well-built DIN-rail-mount terminal strip for organizing field wiring

## Compatible I/O Modules (1794 Series)

- 1794-IB16, 1794-IB32 — Digital input modules
- 1794-OB16, 1794-OB32 — Digital output modules
- 1794-IE8, 1794-IF4I — Analog input modules
- 1794-OE4, 1794-OF4I — Analog output modules

---

Categories:
- [[communication]]
