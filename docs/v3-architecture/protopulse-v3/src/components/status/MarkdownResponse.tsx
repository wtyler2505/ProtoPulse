interface MarkdownResponseProps {
  markdown: string;
}

export function MarkdownResponse({ markdown }: MarkdownResponseProps) {
  const lines = markdown.split('\n');

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {lines.map((line, index) => renderLine(line, index))}
    </div>
  );
}

function renderLine(line: string, index: number) {
  if (line.startsWith('### ')) {
    return <h4 key={index} style={{ margin: '8px 0 0', fontSize: 13 }}>{line.slice(4)}</h4>;
  }
  if (line.startsWith('## ')) {
    return <h3 key={index} style={{ margin: '10px 0 0', fontSize: 14 }}>{line.slice(3)}</h3>;
  }
  if (line.startsWith('# ')) {
    return <h2 key={index} style={{ margin: '10px 0 0', fontSize: 15 }}>{line.slice(2)}</h2>;
  }
  if (line.startsWith('- ')) {
    return <div key={index} style={{ paddingLeft: 10, fontSize: 12, color: '#d9e7ec' }}>• {line.slice(2)}</div>;
  }
  if (line.startsWith('```')) {
    return <div key={index} style={{ borderTop: '1px solid #31434a', marginTop: 4 }} />;
  }
  if (!line.trim()) {
    return <div key={index} style={{ height: 4 }} />;
  }
  return <p key={index} style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: '#edf5f7' }}>{line}</p>;
}
