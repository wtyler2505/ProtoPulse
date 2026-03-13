/**
 * ProtocolDecoderPanel — UI panel for I2C / SPI / UART protocol decoding.
 *
 * Shows protocol-selector tabs, per-protocol config inputs, a decoded-frame
 * table with display-mode toggle, and clear/export controls.
 *
 * Uses ProtocolDecoderManager singleton via useSyncExternalStore.
 */

import { memo, useCallback, useSyncExternalStore } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Download, Trash2 } from 'lucide-react';
import {
  ProtocolDecoderManager,
  formatFrame,
  formatTimestamp,
} from '@/lib/serial/protocol-decoder';
import type {
  ProtocolType,
  DisplayMode,
  DecodedFrame,
  I2CAddressMode,
  I2CSpeedGrade,
  BitOrder,
  ParityMode,
  SPIWordSize,
} from '@/lib/serial/protocol-decoder';

// ---------------------------------------------------------------------------
// Manager singleton
// ---------------------------------------------------------------------------

const manager = ProtocolDecoderManager.getInstance();

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single row in the decoded-frame table. */
const FrameRow = memo(function FrameRow({
  frame,
  displayMode,
  index,
}: {
  frame: DecodedFrame;
  displayMode: DisplayMode;
  index: number;
}) {
  const formatted = formatFrame(frame, displayMode);
  const ts = formatTimestamp(frame.timestamp, 'relative');
  const hasError = frame.errors.length > 0;
  const hasWarning = frame.warnings.length > 0;

  let statusColor = 'text-green-400';
  let statusLabel = 'OK';
  if (hasError) {
    statusColor = 'text-red-400';
    statusLabel = frame.errors[0];
  } else if (hasWarning) {
    statusColor = 'text-yellow-400';
    statusLabel = frame.warnings[0];
  }

  return (
    <tr
      data-testid={`frame-row-${index}`}
      className="border-b border-gray-800 text-xs hover:bg-gray-800/50"
    >
      <td className="px-2 py-1 font-mono text-gray-400">{ts}</td>
      <td className="px-2 py-1 font-mono text-cyan-400">{frame.protocol}</td>
      <td className="px-2 py-1 font-mono text-gray-200">{formatted}</td>
      <td className={cn('px-2 py-1 font-mono', statusColor)} title={statusLabel}>
        {hasError ? 'ERR' : hasWarning ? 'WARN' : 'OK'}
      </td>
    </tr>
  );
});

/** I2C config section. */
function I2CConfig() {
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot);

  const handleAddressMode = useCallback((value: string) => {
    manager.setI2COptions({ addressMode: value as I2CAddressMode });
  }, []);

  const handleSpeedGrade = useCallback((value: string) => {
    manager.setI2COptions({ speedGrade: value as I2CSpeedGrade });
  }, []);

  return (
    <div className="flex flex-wrap gap-3 p-2" data-testid="i2c-config">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-400">Address Mode</Label>
        <Select value={state.i2cOptions.addressMode} onValueChange={handleAddressMode}>
          <SelectTrigger className="h-7 w-24 text-xs" data-testid="i2c-address-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7bit">7-bit</SelectItem>
            <SelectItem value="10bit">10-bit</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-400">Speed Grade</Label>
        <Select value={state.i2cOptions.speedGrade} onValueChange={handleSpeedGrade}>
          <SelectTrigger className="h-7 w-28 text-xs" data-testid="i2c-speed-grade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="fast">Fast</SelectItem>
            <SelectItem value="fastplus">Fast+</SelectItem>
            <SelectItem value="highspeed">High-Speed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** SPI config section. */
function SPIConfig() {
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot);

  const handleCPOL = useCallback((value: string) => {
    manager.setSPIOptions({ cpol: Number(value) as 0 | 1 });
  }, []);

  const handleCPHA = useCallback((value: string) => {
    manager.setSPIOptions({ cpha: Number(value) as 0 | 1 });
  }, []);

  const handleBitOrder = useCallback((value: string) => {
    manager.setSPIOptions({ bitOrder: value as BitOrder });
  }, []);

  const handleWordSize = useCallback((value: string) => {
    manager.setSPIOptions({ wordSize: Number(value) as SPIWordSize });
  }, []);

  return (
    <div className="flex flex-wrap gap-3 p-2" data-testid="spi-config">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-400">CPOL</Label>
        <Select value={String(state.spiOptions.cpol)} onValueChange={handleCPOL}>
          <SelectTrigger className="h-7 w-16 text-xs" data-testid="spi-cpol">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0</SelectItem>
            <SelectItem value="1">1</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-400">CPHA</Label>
        <Select value={String(state.spiOptions.cpha)} onValueChange={handleCPHA}>
          <SelectTrigger className="h-7 w-16 text-xs" data-testid="spi-cpha">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0</SelectItem>
            <SelectItem value="1">1</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-400">Bit Order</Label>
        <Select value={state.spiOptions.bitOrder} onValueChange={handleBitOrder}>
          <SelectTrigger className="h-7 w-20 text-xs" data-testid="spi-bit-order">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MSB">MSB</SelectItem>
            <SelectItem value="LSB">LSB</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-400">Word Size</Label>
        <Select value={String(state.spiOptions.wordSize)} onValueChange={handleWordSize}>
          <SelectTrigger className="h-7 w-16 text-xs" data-testid="spi-word-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="8">8</SelectItem>
            <SelectItem value="16">16</SelectItem>
            <SelectItem value="32">32</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** UART config section. */
function UARTConfig() {
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot);

  const handleBaudRate = useCallback((value: string) => {
    manager.setUARTOptions({ baudRate: Number(value) });
  }, []);

  const handleDataBits = useCallback((value: string) => {
    manager.setUARTOptions({ dataBits: Number(value) as 5 | 6 | 7 | 8 | 9 });
  }, []);

  const handleParity = useCallback((value: string) => {
    manager.setUARTOptions({ parity: value as ParityMode });
  }, []);

  const handleStopBits = useCallback((value: string) => {
    manager.setUARTOptions({ stopBits: Number(value) as 1 | 1.5 | 2 });
  }, []);

  return (
    <div className="flex flex-wrap gap-3 p-2" data-testid="uart-config">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-400">Baud Rate</Label>
        <Select value={String(state.uartOptions.baudRate)} onValueChange={handleBaudRate}>
          <SelectTrigger className="h-7 w-24 text-xs" data-testid="uart-baud-rate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="9600">9600</SelectItem>
            <SelectItem value="19200">19200</SelectItem>
            <SelectItem value="38400">38400</SelectItem>
            <SelectItem value="57600">57600</SelectItem>
            <SelectItem value="115200">115200</SelectItem>
            <SelectItem value="230400">230400</SelectItem>
            <SelectItem value="460800">460800</SelectItem>
            <SelectItem value="921600">921600</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-400">Data Bits</Label>
        <Select value={String(state.uartOptions.dataBits)} onValueChange={handleDataBits}>
          <SelectTrigger className="h-7 w-16 text-xs" data-testid="uart-data-bits">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="6">6</SelectItem>
            <SelectItem value="7">7</SelectItem>
            <SelectItem value="8">8</SelectItem>
            <SelectItem value="9">9</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-400">Parity</Label>
        <Select value={state.uartOptions.parity} onValueChange={handleParity}>
          <SelectTrigger className="h-7 w-20 text-xs" data-testid="uart-parity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="even">Even</SelectItem>
            <SelectItem value="odd">Odd</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-gray-400">Stop Bits</Label>
        <Select value={String(state.uartOptions.stopBits)} onValueChange={handleStopBits}>
          <SelectTrigger className="h-7 w-16 text-xs" data-testid="uart-stop-bits">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="1.5">1.5</SelectItem>
            <SelectItem value="2">2</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export const ProtocolDecoderPanel = memo(function ProtocolDecoderPanel() {
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot);

  const handleProtocolChange = useCallback((value: string) => {
    manager.setProtocol(value as ProtocolType);
  }, []);

  const handleDisplayModeChange = useCallback((value: string) => {
    manager.setDisplayMode(value as DisplayMode);
  }, []);

  const handleClear = useCallback(() => {
    manager.clearFrames();
  }, []);

  const handleExport = useCallback(() => {
    const text = manager.exportFrames();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-decode-${state.protocol.toLowerCase()}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.protocol]);

  return (
    <div
      className="flex h-full flex-col border-l border-gray-800 bg-gray-950"
      data-testid="protocol-decoder-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
        <h3 className="text-sm font-semibold text-cyan-400">Protocol Decoder</h3>
        <div className="flex items-center gap-2">
          <Select value={state.displayMode} onValueChange={handleDisplayModeChange}>
            <SelectTrigger className="h-7 w-24 text-xs" data-testid="display-mode-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hex">Hex</SelectItem>
              <SelectItem value="ascii">ASCII</SelectItem>
              <SelectItem value="decimal">Decimal</SelectItem>
              <SelectItem value="binary">Binary</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleExport}
            title="Export decoded frames"
            data-testid="export-frames-btn"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-400 hover:text-red-300"
            onClick={handleClear}
            title="Clear all frames"
            data-testid="clear-frames-btn"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Protocol tabs */}
      <Tabs value={state.protocol} onValueChange={handleProtocolChange} className="flex flex-1 flex-col">
        <TabsList className="mx-2 mt-2 grid w-auto grid-cols-3">
          <TabsTrigger value="I2C" data-testid="tab-i2c" className="text-xs">
            I2C
          </TabsTrigger>
          <TabsTrigger value="SPI" data-testid="tab-spi" className="text-xs">
            SPI
          </TabsTrigger>
          <TabsTrigger value="UART" data-testid="tab-uart" className="text-xs">
            UART
          </TabsTrigger>
        </TabsList>

        <TabsContent value="I2C" className="mt-0 flex-none">
          <I2CConfig />
        </TabsContent>
        <TabsContent value="SPI" className="mt-0 flex-none">
          <SPIConfig />
        </TabsContent>
        <TabsContent value="UART" className="mt-0 flex-none">
          <UARTConfig />
        </TabsContent>

        {/* Frame table */}
        <div className="flex-1 overflow-auto p-2">
          {state.frames.length === 0 ? (
            <div
              className="flex h-full items-center justify-center text-xs text-gray-500"
              data-testid="empty-state"
            >
              No decoded frames. Connect a device and start decoding.
            </div>
          ) : (
            <table className="w-full text-left" data-testid="frame-table">
              <thead>
                <tr className="border-b border-gray-700 text-xs text-gray-400">
                  <th className="px-2 py-1">Time</th>
                  <th className="px-2 py-1">Protocol</th>
                  <th className="px-2 py-1">Data</th>
                  <th className="px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.frames.map((frame, i) => (
                  <FrameRow
                    key={i}
                    frame={frame}
                    displayMode={state.displayMode}
                    index={i}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Tabs>
    </div>
  );
});
