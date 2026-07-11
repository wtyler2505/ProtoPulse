import type { ReactNode } from "react";
import { Search, Ruler, Hash } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
} from "@/components/ui/input-group";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 420 }}>
    {children}
  </div>
);

export function PartSearch() {
  return (
    <Surface>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <Search />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search components..." defaultValue="0.1uF X7R" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="sm">Search</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Surface>
  );
}

export function ValueWithUnit() {
  return (
    <Surface>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <Ruler />
        </InputGroupAddon>
        <InputGroupInput placeholder="Trace width" defaultValue="0.25" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>mm</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </Surface>
  );
}

export function RefDesignator() {
  return (
    <Surface>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <Hash />
        </InputGroupAddon>
        <InputGroupText>U</InputGroupText>
        <InputGroupInput placeholder="3" defaultValue="3" />
      </InputGroup>
    </Surface>
  );
}
