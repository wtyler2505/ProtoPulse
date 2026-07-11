import type { ReactNode } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { Cpu, Gauge, Radio, Thermometer } from "lucide-react";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 40 }}>
    {children}
  </div>
);

const modules = [
  { name: "ESP32-WROOM-32", detail: "Wi-Fi + BLE MCU module", Icon: Cpu },
  { name: "BME280", detail: "Temp / humidity / pressure", Icon: Thermometer },
  { name: "MPU-6050", detail: "6-axis IMU, I²C", Icon: Gauge },
  { name: "nRF24L01+", detail: "2.4 GHz transceiver", Icon: Radio },
];

export function ModuleGallery() {
  return (
    <Surface>
      <div style={{ width: 280 }}>
        <Carousel>
          <CarouselContent>
            {modules.map(({ name, detail, Icon }) => (
              <CarouselItem key={name}>
                <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-border bg-card">
                  <Icon className="h-8 w-8 text-primary" />
                  <div className="text-sm font-medium">{name}</div>
                  <div className="text-xs text-muted-foreground">{detail}</div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </Surface>
  );
}

export function LayerStack() {
  const layers = ["Top Copper", "Prepreg", "Inner GND", "Core", "Bottom Copper"];
  return (
    <Surface>
      <div style={{ width: 280 }}>
        <Carousel orientation="vertical">
          <CarouselContent className="h-40">
            {layers.map((layer) => (
              <CarouselItem key={layer} className="basis-1/2">
                <div className="flex h-full items-center justify-center rounded-md border border-border bg-muted text-sm font-medium">
                  {layer}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </Surface>
  );
}
