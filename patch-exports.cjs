const fs = require('fs');

let content = fs.readFileSync('server/circuit-routes/exports.ts', 'utf8');

// The error is in ODB++ and IPC-2581 where 'project' is defined twice.
// Let's just rename the second one to 'proj'

content = content.replace(/const \[project, circuits, bomItems\] = await Promise\.all\(\[\n\s+storage\.getProject\(projectId\),\n\s+storage\.getCircuitDesigns\(projectId\),\n\s+storage\.getBomItems\(projectId\),\n\s+\]\);\n\n\s+if \(!project\) \{/g, 
`const [proj, circuits, bomItems] = await Promise.all([
      storage.getProject(projectId),
      storage.getCircuitDesigns(projectId),
      storage.getBomItems(projectId),
    ]);

    if (!proj) {`);

fs.writeFileSync('server/circuit-routes/exports.ts', content, 'utf8');
console.log('Fixed symbol shadowing in exports.ts');
