import type { ReactNode } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24 }}>
    {children}
  </div>
);

export function Collaborators() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Avatar>
          <AvatarFallback>TM</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>RK</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>AV</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback className="bg-primary text-primary-foreground">+5</AvatarFallback>
        </Avatar>
      </div>
    </Surface>
  );
}

export function ProjectOwner() {
  return (
    <Surface>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Avatar className="h-12 w-12">
          <AvatarImage src="https://broken.invalid/avatar.png" alt="Tyler M." />
          <AvatarFallback>TM</AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm font-medium">Tyler M.</div>
          <div className="text-xs text-muted-foreground">Owner &middot; ESP32-Sensor-Node.ppx</div>
        </div>
      </div>
    </Surface>
  );
}
