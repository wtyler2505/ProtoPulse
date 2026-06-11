import type { ArduinoCppFirmwareOutput } from '../../ai/swarms/firmware-writer';

interface FirmwareContractPanelProps {
  output: ArduinoCppFirmwareOutput;
}

export function FirmwareContractPanel({ output }: FirmwareContractPanelProps) {
  return (
    <aside
      style={{
        position: 'fixed',
        top: 494,
        left: 16,
        zIndex: 10,
        width: 280,
        border: '1px solid #3f4732',
        background: '#14180f',
        color: '#f1f8e8',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      <strong style={{ display: 'block', fontSize: 13 }}>Firmware Contract</strong>
      <div style={{ marginTop: 6, fontSize: 11, color: '#cbd8bd' }}>
        {output.sketchName} for {output.board}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
        <Metric label="Files" value={output.files.length} />
        <Metric label="Pins" value={output.ownedPins.length} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#cbd8bd' }}>
        Sketch file: {output.files.find((file) => file.path.endsWith('.ino'))?.path ?? 'missing'}
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #2a3324', background: '#192011', padding: 8 }}>
      <div style={{ color: '#aebb9f', fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 16 }}>{value}</div>
    </div>
  );
}
