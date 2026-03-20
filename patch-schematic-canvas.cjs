const fs = require('fs');

let content = fs.readFileSync('client/src/components/circuit-editor/SchematicCanvas.tsx', 'utf8');

const regex = /case 'escape':\n          setActiveTool\('select'\);\n          announce\(getToolChangeAnnouncement\('select', 'schematic'\)\);\n          break;\n      \}/;

const replacement = `case 'escape':
          setActiveTool('select');
          announce(getToolChangeAnnouncement('select', 'schematic'));
          break;
        case 'arrowup':
        case 'arrowdown':
        case 'arrowleft':
        case 'arrowright': {
          const selectedNodes = localNodes.filter(n => n.selected);
          if (selectedNodes.length === 0) break;
          e.preventDefault();
          const dx = e.key.toLowerCase() === 'arrowleft' ? -10 : e.key.toLowerCase() === 'arrowright' ? 10 : 0;
          const dy = e.key.toLowerCase() === 'arrowup' ? -10 : e.key.toLowerCase() === 'arrowdown' ? 10 : 0;

          // Optimistically update UI
          setLocalNodes(nodes => nodes.map(n => {
            if (n.selected) {
              return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
            }
            return n;
          }));

          // Persist
          selectedNodes.forEach(node => {
            const newPos = { x: node.position.x + dx, y: node.position.y + dy };
            if (node.id.startsWith('power-')) {
              const symbolId = (node.data as any)?.symbolId;
              if (symbolId) {
                const updated = (settings.powerSymbols ?? []).map(ps => ps.id === symbolId ? { ...ps, ...newPos } : ps);
                updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, powerSymbols: updated } });
              }
            } else if (node.id.startsWith('netlabel-')) {
              const labelId = (node.data as any)?.labelId;
              if (labelId) {
                const updated = (settings.netLabels ?? []).map(nl => nl.id === labelId ? { ...nl, ...newPos } : nl);
                updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, netLabels: updated } });
              }
            } else if (node.id.startsWith('noconnect-')) {
              const markerId = (node.data as any)?.markerId;
              if (markerId) {
                const updated = (settings.noConnectMarkers ?? []).map(nc => nc.id === markerId ? { ...nc, ...newPos } : nc);
                updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, noConnectMarkers: updated } });
              }
            } else if (node.id.startsWith('annotation-')) {
              const annotationId = (node.data as any)?.annotationId;
              if (annotationId) {
                const updated = (settings.annotations ?? []).map(a => a.id === annotationId ? { ...a, ...newPos } : a);
                updateDesignRef.current.mutate({ projectId, id: circuitId, settings: { ...settings, annotations: updated } });
              }
            } else {
              const instanceId = (node.data as any)?.instanceId;
              if (typeof instanceId === 'number') {
                updateInstanceRef.current.mutate({ circuitId, id: instanceId, schematicX: newPos.x, schematicY: newPos.y });
              }
            }
          });
          break;
        }
      }`;

content = content.replace(regex, replacement);

fs.writeFileSync('client/src/components/circuit-editor/SchematicCanvas.tsx', content, 'utf8');
console.log('Patched schematic canvas keyboard movement');
