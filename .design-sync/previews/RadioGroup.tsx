import type { ReactNode } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 360 }}>
    {children}
  </div>
);

const Option = ({
  value,
  title,
  hint,
}: {
  value: string;
  title: string;
  hint: string;
}) => (
  <label className="flex items-start gap-3 text-sm" htmlFor={value}>
    <RadioGroupItem id={value} value={value} className="mt-0.5" />
    <span>
      <span className="block font-medium">{title}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </span>
  </label>
);

export function BoardLayers() {
  return (
    <Surface>
      <div className="text-sm font-semibold mb-3">Board layer count</div>
      <RadioGroup defaultValue="4">
        <Option value="2" title="2 layers" hint="Lowest cost, hobby prototypes" />
        <Option value="4" title="4 layers" hint="Dedicated power + ground planes" />
        <Option value="6" title="6 layers" hint="High-speed and dense routing" />
      </RadioGroup>
    </Surface>
  );
}

export function SurfaceFinish() {
  return (
    <Surface>
      <div className="text-sm font-semibold mb-3">PCB surface finish</div>
      <RadioGroup defaultValue="enig">
        <Option value="hasl" title="HASL (lead-free)" hint="Economical, uneven pads" />
        <Option value="enig" title="ENIG" hint="Flat gold finish, fine pitch ready" />
        <Option value="osp" title="OSP" hint="Organic coating, RoHS friendly" />
      </RadioGroup>
    </Surface>
  );
}
