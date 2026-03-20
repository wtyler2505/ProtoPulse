import { generateGerber } from './export/gerber-generator';
import { generateFirmwareScaffold } from './export/firmware-scaffold-generator';
import JSZip from 'jszip';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { storage } from './storage';
import { logger } from './logger';

// In a real desktop app deployment, these would be loaded from a user-provided credentials.json
// or an OAuth flow redirect. For this implementation, we will expect the user to have provided
// an OAuth2 Refresh Token (which we can store securely in the database) or we can use Application Default Credentials.

/**
 * Creates an authenticated Google Sheets API client.
 * For now, we'll expose a function that takes an access token or uses a default configured client.
 */
export function getSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

export function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

export function getDocsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.docs({ version: 'v1', auth });
}

/**
 * Exports a project's BOM to a new Google Sheet.
 */
export async function exportBomToSheet(projectId: number, accessToken: string): Promise<string> {
  const bomItems = await storage.getBomItems(projectId);
  if (!bomItems || bomItems.length === 0) {
    throw new Error('BOM is empty. Add components before exporting to Google Sheets.');
  }

  const sheets = getSheetsClient(accessToken);

  // 1. Create a new spreadsheet
  const project = await storage.getProject(projectId);
  const title = `ProtoPulse BOM: ${project?.name || 'Project'} - ${new Date().toISOString().split('T')[0]}`;
  
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title }
    }
  });

  const spreadsheetId = createRes.data.spreadsheetId;
  if (!spreadsheetId) throw new Error('Failed to create Google Sheet');

  // 2. Prepare the data
  const headers = ['Part Number', 'Manufacturer', 'Description', 'Quantity', 'Unit Price', 'Total Price', 'Supplier', 'Stock Status'];
  const rows = bomItems.map(item => [
    item.partNumber,
    item.manufacturer,
    item.description,
    item.quantity,
    `$${Number(item.unitPrice).toFixed(2)}`,
    `$${Number(item.totalPrice).toFixed(2)}`,
    item.supplier,
    item.status
  ]);

  const values = [headers, ...rows];

  // Calculate total sum row
  const totalCost = bomItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  values.push(['', '', '', '', 'TOTAL COST:', `$${totalCost.toFixed(2)}`, '', '']);

  // 3. Write data to the sheet
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values }
  });

  // 4. Format the header row (bold, background color)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        },
        // Auto-resize columns
        {
          autoResizeDimensions: {
            dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 8 }
          }
        }
      ]
    }
  });

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  logger.info(`Successfully exported BOM to Google Sheet: ${url}`);
  return url;
}

/**
 * Generates a comprehensive Design Report and exports it to a new Google Doc.
 */
export async function exportDesignReportToDoc(projectId: number, accessToken: string): Promise<string> {
  const [project, bomItems, validationIssues, nodes] = await Promise.all([
    storage.getProject(projectId),
    storage.getBomItems(projectId),
    storage.getValidationIssues(projectId),
    storage.getNodes(projectId)
  ]);

  const docs = getDocsClient(accessToken);
  const title = `ProtoPulse Design Report: ${project?.name || 'Project'} - ${new Date().toISOString().split('T')[0]}`;
  
  const createRes = await docs.documents.create({
    requestBody: { title }
  });

  const documentId = createRes.data.documentId;
  if (!documentId) throw new Error('Failed to create Google Doc');

  let totalCost = 0;
  if (bomItems) {
    totalCost = bomItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  }

  // Construct the report text
  const reportText = `ProtoPulse Design Report
Project: ${project?.name || 'Unnamed Project'}
Description: ${project?.description || 'No description provided.'}
Generated: ${new Date().toLocaleString()}

1. Executive Summary
This design contains ${nodes?.length || 0} core components and ${bomItems?.length || 0} BOM items, with an estimated unit cost of $${totalCost.toFixed(2)}.
There are currently ${validationIssues?.length || 0} active validation issues that need review.

2. Bill of Materials
${bomItems?.map(b => `- ${b.quantity}x ${b.partNumber} (${b.manufacturer}) - $${Number(b.totalPrice).toFixed(2)}`).join('\n') || 'No items.'}

3. Validation Status
${validationIssues?.length ? validationIssues.map(v => `[${v.severity.toUpperCase()}] ${v.message} ${v.suggestion ? `(Fix: ${v.suggestion})` : ''}`).join('\n') : 'No active validation issues! Ready for manufacturing.'}

-- End of Report --
`;

  // Insert the text into the document
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: reportText
          }
        },
        // Make the title header a heading
        {
          updateParagraphStyle: {
            range: { startIndex: 1, endIndex: 25 },
            paragraphStyle: { namedStyleType: 'HEADING_1' },
            fields: 'namedStyleType'
          }
        }
      ]
    }
  });

  const url = `https://docs.google.com/document/d/${documentId}/edit`;
  logger.info(`Successfully exported Design Report to Google Doc: ${url}`);
  return url;
}


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
  let bomCsv = 'Part Number,Manufacturer,Description,Quantity,Unit Price,Total Price,Supplier,Stock Status\n';
  if (bomItems) {
    bomCsv += bomItems.map(item => 
      `"${item.partNumber}","${item.manufacturer}","${item.description}",${item.quantity},${item.unitPrice},${item.totalPrice},"${item.supplier}","${item.status}"`
    ).join('\n');
  }
  zip.file('BOM.csv', bomCsv);

  // 4. Create the final Zip
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  // 5. Upload to Google Drive
  const folderName = `ProtoPulse Manufacturing Package: ${project.name}`;
  
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
    name: `${project.name}_Manufacturing.zip`,
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

  return uploadRes.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`;
}
