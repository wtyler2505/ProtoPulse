const fs = require('fs');

let content = fs.readFileSync('server/routes/arduino.ts', 'utf8');

const replacement = `  // --- OTA mDNS Discovery (BL-0611) ---
  app.get('/api/arduino/mdns-discover', asyncHandler(async (req, res) => {
    try {
      const { Bonjour } = await import('bonjour-service');
      const bonjour = new Bonjour();
      const devices: any[] = [];
      
      const browser = bonjour.find({ type: 'arduino' }, (service) => {
        devices.push({
          name: service.name,
          host: service.host,
          fqdn: service.fqdn,
          port: service.port,
          txt: service.txt,
          ip: service.addresses?.[0] || null
        });
      });

      // Wait 3 seconds for devices to respond
      await new Promise(resolve => setTimeout(resolve, 3000));
      browser.stop();
      bonjour.destroy();

      res.json({ devices });
    } catch (err: any) {
      res.status(500).json({ message: \`mDNS discovery failed: \${err.message}\` });
    }
  }));

}
`;

content = content.replace(/\}\n$/, replacement);
fs.writeFileSync('server/routes/arduino.ts', content, 'utf8');
console.log('Patched arduino routes for mDNS');
