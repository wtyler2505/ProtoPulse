import { i2cDeviceForPart } from '@protopulse/emu';

import type { I2cDeviceBinding } from './types.js';
import type { DesignGraph } from '@protopulse/graph';

/**
 * Resolve every modeled I2C part placed in a design to a co-sim device binding,
 * using the @protopulse/emu device registry (`i2cDeviceForPart`). DNP parts are
 * skipped. The result is meant to be passed as `ClosedLoopSpec.i2cDevices` so a
 * caller need not hand-list each sensor.
 *
 * Devices are assigned to controller **port 0**: the ESP32-S3 routes I2C over
 * the GPIO matrix, so which controller a sensor is wired to is a firmware-mux
 * decision the design graph does not encode — port 0 is the convention. Re-map
 * the returned bindings' `port` for a device on I2C1.
 */
export function i2cDevicesFromGraph(graph: DesignGraph): I2cDeviceBinding[] {
  const bindings: I2cDeviceBinding[] = [];
  for (const component of graph.components.values()) {
    if (component.dnp) continue;
    const slave = i2cDeviceForPart(component.partId);
    if (slave !== null) bindings.push({ port: 0, slave });
  }
  return bindings;
}
