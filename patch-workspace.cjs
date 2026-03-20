const fs = require('fs');
let content = fs.readFileSync('server/google-workspace.ts', 'utf8');

const imports = `import { generateGerber } from './export/gerber-generator';
import { generateFirmwareScaffold } from './export/firmware-scaffold-generator';
import JSZip from 'jszip';
import { Readable } from 'stream';\n`;

const newFunction = `

export async function exportProjectToDrive(projectId: number, accessToken: string): Promise<string> {
  const [project, bomItems, validationIssues, nodes, edges, circuits] = await Promise.all([
    storage.getProject(projectId),
    storage.getBomItems(projectId),
    storage.getValidationIssues(projectId),
    storage.getNodes(projectId),
    storage.getEdges(projectId),
    storage.getCircuitDesigns(projectId)
  ]);

  if (!project) throw new Error('Project not found');

  const drive = getDriveClient(accessToken);
  const zip = new JSZip();

  // 1. Generate Gerbers
  const boardWidth = 100;
  const boardHeight = 100;
  let pcbWires: any[] = [];
  if (circuits.length > 0) {
    const data = await storage.getCircuitWires(circuits[0].id);
    pcbWires = data.filter((w: any) => w.view === 'pcb');
  }
  
  const gerberOutput = generateGerber({
    boardWidth,
    boardHeight,
    nodes: nodes.map(n => ({
      nodeId: n.nodeId,
      positionX: n.positionX,
      positionY: n.positionY,
      data: n.data as Record<string, unknown> | null,
    })),
    wires: pcbWires.map((w: any) => ({
      wireId: w.id.toString(),
      sourceInstanceId: w.sourceInstanceId.toString(),
      targetInstanceId: w.targetInstanceId.toString(),
      vertices: Array.isArray(w.vertices) ? w.vertices : [],
      width: w.width,
      layer: w.layer || 'F.Cu',
    })),
  });

  const gerberFolder = zip.folder('gerbers');
  for (const file of gerberOutput.files) {
    gerberFolder?.file(file.filename, file.content);
  }

  // 2. Generate Firmware Scaffold
  const fwOutput = generateFirmwareScaffold({
    nodes: nodes.map(n => ({
      nodeId: n.nodeId,
      label: n.label,
      nodeType: n.nodeType,
      positionX: n.positionX,
      positionY: n.positionY,
      data: n.data as Record<string, unknown> | null,
    })),
    edges: edges.map(e => ({
      edgeId: e.edgeId,
      source: e.source,
      target: e.target,
      label: e.label ?? null,
      signalType: e.signalType ?? null,
      voltage: e.voltage ?? null,
      busWidth: e.busWidth ?? null,
      netName: e.netName ?? null,
    })),
  });

  const fwFolder = zip.folder('firmware');
  for (const file of fwOutput.files) {
    fwFolder?.file(file.filename, file.content);
  }

  // 3. Generate BOM CSV
  let bomCsv = 'Part Number,Manufacturer,Description,Quantity,Unit Price,Total Price,Supplier,Stock Status\\n';
  if (bomItems) {
    bomCsv += bomItems.map(item => 
      \`"\${item.partNumber}","\${item.manufacturer}","\${item.description}",\${item.quantity},\${item.unitPrice},\${item.totalPrice},"\${item.supplier}","\${item.status}"\`
    ).join('\\n');
  }
  zip.file('BOM.csv', bomCsv);

  // 4. Create the final Zip
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  // 5. Upload to Google Drive
  const folderName = \`ProtoPulse Manufacturing Package: \${project.name}\`;
  
  // Create folder
  const folderRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    },
    fields: 'id'
  });
  
  const folderId = folderRes.data.id;
  if (!folderId) throw new Error('Failed to create Drive folder');

  // Upload Zip
  const fileMetadata = {
    name: \`\${project.name}_Manufacturing.zip\`,
    parents: [folderId]
  };
  
  const media = {
    mimeType: 'application/zip',
    body: Readable.from(zipBuffer)
  };

  const uploadRes = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink'
  });

  return uploadRes.data.webViewLink || \`https://drive.google.com/drive/folders/\${folderId}\`;
}
`;

content = imports + content + newFunction;
fs.writeFileSync('server/google-workspace.ts', content, 'utf8');
console.log('Appended to server/google-workspace.ts');
