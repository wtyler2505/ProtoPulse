import { generateArduinoSketchFlow } from './server/genkit';

async function main() {
  console.log("Testing Genkit Arduino Sketch Flow...");
  try {
    const result = await generateArduinoSketchFlow({
      intent: "blink an LED on pin 13",
      boardType: "Arduino Uno"
    });
    console.log("\n--- Genkit Execution Success ---\n");
    console.log(result);
  } catch (error) {
    console.error("Genkit Flow Error:", error);
  }
}

main();