import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  CircuitBoard,
  Cpu,
  Layers,
  PencilRuler,
  ShoppingCart,
  TriangleAlert,
  Waves,
} from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div
    className="bg-background text-foreground"
    style={{ padding: 0, minHeight: 460, display: "flex" }}
  >
    {children}
  </div>
);

export function ProjectNav() {
  return (
    <Surface>
      <SidebarProvider>
        <Sidebar collapsible="none">
          <SidebarHeader>
            <div className="px-2 py-1.5 text-sm font-semibold">
              ProtoPulse · SMPS Ref
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Design</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive>
                      <PencilRuler />
                      <span>Schematic</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <CircuitBoard />
                      <span>PCB Layout</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <Layers />
                      <span>3D Viewer</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <Waves />
                      <span>Simulation</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Build</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <Cpu />
                      <span>Firmware</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <ShoppingCart />
                      <span>Procurement</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>27</SidebarMenuBadge>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <TriangleAlert />
                  <span>Validation</span>
                  <SidebarMenuBadge>3</SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </Surface>
  );
}

export function NetExplorer() {
  const nets = ["+5V", "+3V3", "GND", "SDA", "SCL", "MOSI", "MISO", "SCK"];
  return (
    <Surface>
      <SidebarProvider>
        <Sidebar collapsible="none">
          <SidebarHeader>
            <div className="px-2 py-1.5 text-sm font-semibold">Nets</div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Power &amp; Signals</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nets.map((net, i) => (
                    <SidebarMenuItem key={net}>
                      <SidebarMenuButton isActive={i === 0}>
                        <span className="font-mono">{net}</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>{12 - i}</SidebarMenuBadge>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </Surface>
  );
}
