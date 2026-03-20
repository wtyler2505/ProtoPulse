import { embodiedLayoutAnalysisFlow } from './server/genkit';

async function main() {
  console.log("Testing Genkit ER Flow...");
  try {
    const result = await embodiedLayoutAnalysisFlow({
      projectId: 1,
      chassisDescription: "A 4-wheel rover chassis with a 20x20cm base. Heavy LiPo battery pack. Using an ESP32 and a DHT11 sensor.",
      query: "Where should I mount the battery, ESP32, and the DHT11 sensor to ensure stability and accurate readings?"
    });
    console.log("\n--- Genkit Execution Success ---\n");
    console.log(result);
  } catch (error) {
    console.error("Genkit Flow Error:", error);
  }
}

main();