import type { ReactNode } from "react";
import {
  FieldSet,
  FieldLegend,
  FieldGroup,
  Field,
  FieldLabel,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldSeparator,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 480 }}>
    {children}
  </div>
);

export function BoardSettings() {
  return (
    <Surface>
      <FieldSet>
        <FieldLegend>Board fabrication settings</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="trace">Minimum trace width (mm)</FieldLabel>
            <Input id="trace" defaultValue="0.15" />
            <FieldDescription>
              JLCPCB 2-layer process supports down to 0.127 mm (5 mil).
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="clearance">Copper clearance (mm)</FieldLabel>
            <Input id="clearance" defaultValue="0.2" />
            <FieldDescription>Minimum spacing between distinct nets.</FieldDescription>
          </Field>
        </FieldGroup>
      </FieldSet>
    </Surface>
  );
}

export function ValidationError() {
  return (
    <Surface>
      <FieldGroup>
        <Field data-invalid="true">
          <FieldLabel htmlFor="via">Via drill diameter (mm)</FieldLabel>
          <Input id="via" defaultValue="0.1" aria-invalid="true" />
          <FieldError errors={[{ message: "Drill 0.1 mm is below the 0.3 mm fab minimum." }]} />
        </Field>
        <FieldSeparator>Advanced</FieldSeparator>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>Tented vias</FieldTitle>
            <FieldDescription>Cover vias with soldermask on both sides.</FieldDescription>
          </FieldContent>
          <Input id="tented" defaultValue="Enabled" style={{ maxWidth: 120 }} />
        </Field>
      </FieldGroup>
    </Surface>
  );
}
