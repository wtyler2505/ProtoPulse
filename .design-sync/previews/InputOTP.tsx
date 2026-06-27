import type { ReactNode } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 32, maxWidth: 420 }}>
    {children}
  </div>
);

export function ShareCode() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 10 }}>
        <span className="text-sm text-muted-foreground">
          Enter the 6-digit code to join this design session
        </span>
        <InputOTP maxLength={6} value="482915">
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>
    </Surface>
  );
}

export function DeviceClaim() {
  return (
    <Surface>
      <div style={{ display: "grid", gap: 10 }}>
        <span className="text-sm text-muted-foreground">
          Pairing code shown on the ESP32 serial monitor
        </span>
        <InputOTP maxLength={4} value="73A">
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
        </InputOTP>
      </div>
    </Surface>
  );
}
