import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Surface = ({ children }: { children: ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, maxWidth: 460 }}>
    {children}
  </div>
);

export function ComponentProperties() {
  const form = useForm({
    defaultValues: { refDes: "U1", mpn: "ATmega328P-PU", value: "" },
  });
  return (
    <Surface>
      <Form {...form}>
        <form style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FormField
            control={form.control}
            name="refDes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reference designator</FormLabel>
                <FormControl>
                  <Input placeholder="U1" {...field} />
                </FormControl>
                <FormDescription>
                  Unique identifier on the schematic and silkscreen.
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mpn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Manufacturer part number</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. ATmega328P-PU" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="button">Save component</Button>
        </form>
      </Form>
    </Surface>
  );
}

export function NetLabelWithError() {
  const form = useForm({ defaultValues: { netName: "" } });
  return (
    <Surface>
      <Form {...form}>
        <form style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FormField
            control={form.control}
            name="netName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Net name</FormLabel>
                <FormControl>
                  <Input placeholder="+3V3" {...field} />
                </FormControl>
                <FormDescription>
                  Power nets get a power-flag symbol automatically.
                </FormDescription>
                <FormMessage>Net name &ldquo;GND&rdquo; already exists on this sheet.</FormMessage>
              </FormItem>
            )}
          />
          <Button type="button" variant="outline">
            Rename net
          </Button>
        </form>
      </Form>
    </Surface>
  );
}
