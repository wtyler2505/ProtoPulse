import json
import os
import argparse

def run_audit(manifest_path, constraints_path):
    with open(manifest_path, 'r') as f:
        manifest = json.load(f)
    with open(constraints_path, 'r') as f:
        constraints = json.load(f)

    inventory_parts = []
    for data in manifest.values():
        if isinstance(data, list): data = data[0]
        part_no = data.get("manufacturer_part_number", "").lower()
        inventory_parts.append(part_no)

    reports = []
    
    # 1. Logic Level Audit
    controllers = [p for p in inventory_parts if any(name in p for name in constraints["logic_levels"].keys())]
    power_parts = [p for p in inventory_parts if any(name in p for name in constraints["power_modules"].keys())]

    for ctrl in controllers:
        ctrl_key = next((k for k in constraints["logic_levels"].keys() if k in ctrl), None)
        if not ctrl_key: continue
        
        ctrl_v = constraints["logic_levels"][ctrl_key]["v_logic"]
        
        for pwr in power_parts:
            pwr_key = next((k for k in constraints["power_modules"].keys() if k in pwr), None)
            if not pwr_key: continue
            
            # Check for L298N + ESP32/Pi conflict
            if "l298n" in pwr_key and ctrl_v < 5.0:
                reports.append({
                    "severity": "WARNING",
                    "title": f"Voltage Mismatch: {ctrl.upper()} + L298N",
                    "description": f"The L298N uses 5V logic inputs. Your {ctrl.upper()} uses {ctrl_v}V logic. Direct connection may result in unreliable triggering or damage to the controller if the L298N 5V line backfeeds."
                })
            
            # Check for Relay Coil conflict
            if "srd-05vdc" in pwr_key and ctrl_v < 5.0:
                reports.append({
                    "severity": "CRITICAL",
                    "title": f"Incompatible Coil Voltage: {ctrl.upper()} + Relay",
                    "description": f"This relay has a 5V coil. Your {ctrl.upper()} cannot trigger it directly from a {ctrl_v}V GPIO pin. You need a transistor driver or a level shifter."
                })

    return reports

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest")
    parser.add_argument("constraints")
    args = parser.parse_args()
    
    results = run_audit(args.manifest, args.constraints)
    
    print("# 🛡️ Anti-Smoke Safety Audit Report\n")
    if not results:
        print("✅ No immediate hardware conflicts detected in current inventory.")
    else:
        for r in results:
            icon = "⚠️" if r["severity"] == "WARNING" else "🛑"
            print(f"### {icon} {r['title']}")
            print(f"> **Status:** {r['severity']}\n")
            print(f"{r['description']}\n")

if __name__ == "__main__":
    main()
