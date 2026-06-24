import { spiDeviceForPart } from '@protopulse/emu';

import type { SpiDeviceBinding } from './types.js';
import type { DesignGraph } from '@protopulse/graph';

/**
 * Resolve every modeled SPI part placed in a design to a co-sim device binding,
 * using the @protopulse/emu device registry (`spiDeviceForPart`). DNP parts are
 * skipped. The result is meant to be passed as `ClosedLoopSpec.spiDevices` so a
 * caller need not hand-list each device — the SPI parallel to
 * {@link i2cDevicesFromGraph}.
 *
 * Devices are assigned to controller **port 2** (GPSPI2): the ESP32-S3 routes
 * SPI over the GPIO matrix, so which controller a device is wired to is a
 * firmware-mux decision the design graph does not encode — GPSPI2 is the
 * common application-SPI controller. Re-map the returned bindings' `port` for a
 * device on GPSPI3.
 */
export function spiDevicesFromGraph(graph: DesignGraph): SpiDeviceBinding[] {
  const bindings: SpiDeviceBinding[] = [];
  for (const component of graph.components.values()) {
    if (component.dnp) continue;
    const slave = spiDeviceForPart(component.partId);
    if (slave !== null) bindings.push({ port: 2, slave });
  }
  return bindings;
}
