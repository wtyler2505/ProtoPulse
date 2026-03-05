/**
 * EmbedViewerPage Tests
 *
 * Tests the read-only embed viewer page that renders circuit data
 * from URL parameters or server short codes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock @xyflow/react
vi.mock('@xyflow/react', () => {
  const ReactFlowProvider = ({ children }: { children: React.ReactNode }) => <div data-testid="mock-rfp">{children}</div>;
  const ReactFlow = (props: Record<string, unknown>) => (
    <div
      data-testid="mock-reactflow"
      data-nodes-draggable={String(props.nodesDraggable)}
      data-nodes-connectable={String(props.nodesConnectable)}
      data-elements-selectable={String(props.elementsSelectable)}
    >
      {(props.children as React.ReactNode)}
    </div>
  );
  const Background = () => <div data-testid="mock-background" />;
  const Controls = () => <div data-testid="mock-controls" />;
  return { ReactFlowProvider, ReactFlow, Background, Controls };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <span data-testid={`icon-${name}`} {...props} />;
  return {
    ExternalLink: icon('external-link'),
    Loader2: icon('loader'),
    AlertCircle: icon('alert-circle'),
  };
});

// Mock the EmbedManager — vi.hoisted ensures variables exist when vi.mock factory runs
const { mockDecode, mockFetchShortUrl, mockResolveTheme, mockParseThemeFromParams, MockEmbedManager } = vi.hoisted(() => {
  const _mockDecode = vi.fn();
  const _mockFetchShortUrl = vi.fn();
  const _mockResolveTheme = vi.fn();
  const _mockParseThemeFromParams = vi.fn();

  class _MockEmbedManager {
    decode = _mockDecode;
    fetchShortUrl = _mockFetchShortUrl;
    resolveTheme = _mockResolveTheme;
    parseThemeFromParams = _mockParseThemeFromParams;
  }

  return {
    mockDecode: _mockDecode,
    mockFetchShortUrl: _mockFetchShortUrl,
    mockResolveTheme: _mockResolveTheme,
    mockParseThemeFromParams: _mockParseThemeFromParams,
    MockEmbedManager: _MockEmbedManager,
  };
});

vi.mock('@/lib/embed-viewer', () => ({
  EmbedManager: MockEmbedManager,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import EmbedViewerPage from '@/pages/EmbedViewerPage';

import type { EmbedCircuitData, EmbedTheme } from '@/lib/embed-viewer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const defaultTheme: EmbedTheme = {
  dark: true,
  accentColor: '#00F0FF',
  showGrid: true,
  showLabels: true,
};

const sampleCircuit: EmbedCircuitData = {
  nodes: [
    { id: 'n1', type: 'resistor', label: 'R1', x: 100, y: 200 },
    { id: 'n2', type: 'capacitor', label: 'C1', x: 300, y: 200 },
  ],
  wires: [
    { id: 1, netId: 1, points: ['n1', 'n2'] },
  ],
  nets: [
    { id: 1, name: 'NET1' },
  ],
  metadata: { name: 'Test Circuit' },
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTheme.mockReturnValue(defaultTheme);
  mockParseThemeFromParams.mockReturnValue({});
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmbedViewerPage', () => {
  describe('loading state', () => {
    it('shows loading indicator initially', () => {
      // decode never resolves — stays in loading
      mockDecode.mockReturnValue(new Promise(() => {}));
      render(<EmbedViewerPage dataParam="rABC123" />);
      expect(screen.getByTestId('embed-loading')).toBeDefined();
    });

    it('displays "Loading schematic..." text', () => {
      mockDecode.mockReturnValue(new Promise(() => {}));
      render(<EmbedViewerPage dataParam="rABC123" />);
      expect(screen.getByText('Loading schematic...')).toBeDefined();
    });
  });

  describe('rendering from URL data', () => {
    it('decodes and renders circuit from dataParam', async () => {
      mockDecode.mockResolvedValue(sampleCircuit);
      render(<EmbedViewerPage dataParam="rEncodedData" />);

      await waitFor(() => {
        expect(screen.getByTestId('embed-viewer')).toBeDefined();
      });
      expect(mockDecode).toHaveBeenCalledWith('rEncodedData');
    });

    it('shows the circuit title from metadata', async () => {
      mockDecode.mockResolvedValue(sampleCircuit);
      render(<EmbedViewerPage dataParam="rEncodedData" />);

      await waitFor(() => {
        const title = screen.getByTestId('embed-title');
        expect(title.textContent).toBe('Test Circuit');
      });
    });

    it('renders ReactFlow in read-only mode', async () => {
      mockDecode.mockResolvedValue(sampleCircuit);
      render(<EmbedViewerPage dataParam="rEncodedData" />);

      await waitFor(() => {
        const flow = screen.getByTestId('mock-reactflow');
        expect(flow.getAttribute('data-nodes-draggable')).toBe('false');
        expect(flow.getAttribute('data-nodes-connectable')).toBe('false');
        expect(flow.getAttribute('data-elements-selectable')).toBe('false');
      });
    });

    it('shows "Powered by ProtoPulse" watermark', async () => {
      mockDecode.mockResolvedValue(sampleCircuit);
      render(<EmbedViewerPage dataParam="rEncodedData" />);

      await waitFor(() => {
        expect(screen.getByTestId('embed-watermark')).toBeDefined();
        expect(screen.getByText('ProtoPulse')).toBeDefined();
      });
    });

    it('shows "Open in ProtoPulse" button', async () => {
      mockDecode.mockResolvedValue(sampleCircuit);
      render(<EmbedViewerPage dataParam="rEncodedData" />);

      await waitFor(() => {
        const link = screen.getByTestId('embed-open-editor');
        expect(link).toBeDefined();
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      });
    });

    it('renders background when showGrid is true', async () => {
      mockResolveTheme.mockReturnValue({ ...defaultTheme, showGrid: true });
      mockDecode.mockResolvedValue(sampleCircuit);
      render(<EmbedViewerPage dataParam="rEncodedData" />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-background')).toBeDefined();
      });
    });
  });

  describe('rendering from short code', () => {
    it('fetches and decodes from server short URL', async () => {
      mockFetchShortUrl.mockResolvedValue('rEncodedFromServer');
      mockDecode.mockResolvedValue(sampleCircuit);
      render(<EmbedViewerPage codeParam="abcd1234" />);

      await waitFor(() => {
        expect(screen.getByTestId('embed-viewer')).toBeDefined();
      });
      expect(mockFetchShortUrl).toHaveBeenCalledWith('abcd1234');
      expect(mockDecode).toHaveBeenCalledWith('rEncodedFromServer');
    });
  });

  describe('error state', () => {
    it('shows error when decode fails', async () => {
      mockDecode.mockRejectedValue(new Error('Corrupt data'));
      render(<EmbedViewerPage dataParam="rBadData" />);

      await waitFor(() => {
        expect(screen.getByTestId('embed-error')).toBeDefined();
      });
      expect(screen.getByText('Corrupt data')).toBeDefined();
    });

    it('shows error when short URL fetch fails', async () => {
      mockFetchShortUrl.mockRejectedValue(new Error('Embed not found or expired'));
      render(<EmbedViewerPage codeParam="noexist" />);

      await waitFor(() => {
        expect(screen.getByTestId('embed-error')).toBeDefined();
      });
      expect(screen.getByText('Embed not found or expired')).toBeDefined();
    });

    it('shows error when no data provided', async () => {
      render(<EmbedViewerPage />);

      await waitFor(() => {
        expect(screen.getByTestId('embed-error')).toBeDefined();
      });
      expect(screen.getByText('No circuit data provided')).toBeDefined();
    });

    it('shows "Failed to load schematic" heading on error', async () => {
      mockDecode.mockRejectedValue(new Error('fail'));
      render(<EmbedViewerPage dataParam="rBad" />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load schematic')).toBeDefined();
      });
    });

    it('shows link to ProtoPulse on error', async () => {
      mockDecode.mockRejectedValue(new Error('fail'));
      render(<EmbedViewerPage dataParam="rBad" />);

      await waitFor(() => {
        const link = screen.getByTestId('embed-error-link');
        expect(link).toBeDefined();
        expect(link.getAttribute('target')).toBe('_blank');
      });
    });

    it('handles non-Error exceptions gracefully', async () => {
      mockDecode.mockRejectedValue('string error');
      render(<EmbedViewerPage dataParam="rBad" />);

      await waitFor(() => {
        expect(screen.getByTestId('embed-error')).toBeDefined();
      });
      expect(screen.getByText('Failed to load circuit data')).toBeDefined();
    });
  });

  describe('circuit without metadata', () => {
    it('does not show title when metadata is missing', async () => {
      const noMeta: EmbedCircuitData = {
        nodes: [{ id: 'n1', type: 'r', label: 'R1', x: 0, y: 0 }],
        wires: [],
        nets: [],
      };
      mockDecode.mockResolvedValue(noMeta);
      render(<EmbedViewerPage dataParam="rData" />);

      await waitFor(() => {
        expect(screen.getByTestId('embed-viewer')).toBeDefined();
      });
      expect(screen.queryByTestId('embed-title')).toBeNull();
    });
  });

  describe('theme', () => {
    it('applies dark background color by default', async () => {
      mockDecode.mockResolvedValue(sampleCircuit);
      render(<EmbedViewerPage dataParam="rData" />);

      await waitFor(() => {
        const viewer = screen.getByTestId('embed-viewer');
        expect(viewer.style.backgroundColor).toBe('#0a0a0f');
      });
    });

    it('applies light background when theme is light', async () => {
      mockResolveTheme.mockReturnValue({ ...defaultTheme, dark: false });
      mockDecode.mockResolvedValue(sampleCircuit);
      render(<EmbedViewerPage dataParam="rData" />);

      await waitFor(() => {
        const viewer = screen.getByTestId('embed-viewer');
        expect(viewer.style.backgroundColor).toBe('#f8f9fa');
      });
    });
  });

  describe('ReactFlowProvider', () => {
    it('wraps the viewer in ReactFlowProvider', async () => {
      mockDecode.mockResolvedValue(sampleCircuit);
      render(<EmbedViewerPage dataParam="rData" />);

      await waitFor(() => {
        expect(screen.getByTestId('mock-rfp')).toBeDefined();
      });
    });
  });
});
