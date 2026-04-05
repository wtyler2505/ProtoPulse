import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Edge, Node } from '@xyflow/react';
import type { BomItem, ValidationIssue } from '@/lib/project-context';

const mockAuth = {
  sessionId: 'session-1' as string | null,
  connectionStatus: 'connected' as 'connected' | 'reconnecting' | 'offline',
};

const mockSafety = {
  enabled: true,
};

const mockReview = {
  stats: {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    averageConfidence: 0,
    oldestPendingAge: null,
  },
  threshold: 50,
};

const mockNodes: Node[] = [
  {
    id: 'n-1',
    type: 'mcu',
    position: { x: 0, y: 0 },
    data: {
      label: 'Controller',
      description: 'Main logic node',
    },
  },
];

const mockEdges: Edge[] = [
  {
    id: 'e-1',
    source: 'n-1',
    target: 'n-1',
  },
];

const mockBom: BomItem[] = [
  {
    id: 'b-1',
    partNumber: 'ATmega328P-PU',
    manufacturer: 'Microchip',
    description: '8-bit MCU',
    quantity: 1,
    unitPrice: 2.4,
    totalPrice: 2.4,
    supplier: 'Digi-Key',
    stock: 100,
    status: 'In Stock',
    assemblyCategory: 'through_hole',
    esdSensitive: false,
  },
];

const mockIssues: ValidationIssue[] = [
  {
    id: 'v-1',
    severity: 'info',
    message: 'Minor note',
  },
];

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: null,
    sessionId: mockAuth.sessionId,
    loading: false,
    connectionStatus: mockAuth.connectionStatus,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/lib/ai-safety-mode', () => ({
  useAISafetyMode: () => ({
    enabled: mockSafety.enabled,
    toggle: vi.fn(),
    setEnabled: vi.fn(),
    classifyAction: vi.fn(),
    getTeachingExplanation: vi.fn(),
    getSafetyInfo: vi.fn(),
    needsConfirmation: vi.fn(),
    dismissAction: vi.fn(),
    undismissAction: vi.fn(),
    isDismissed: vi.fn(),
    clearDismissed: vi.fn(),
  }),
}));

vi.mock('@/lib/ai-review-queue', () => ({
  useReviewQueue: () => ({
    pendingItems: [],
    approvedItems: [],
    rejectedItems: [],
    stats: mockReview.stats,
    approveItem: vi.fn(),
    rejectItem: vi.fn(),
    addToQueue: vi.fn(),
    clearResolved: vi.fn(),
    threshold: mockReview.threshold,
    setThreshold: vi.fn(),
    shouldQueue: vi.fn(),
  }),
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: mockNodes,
    edges: mockEdges,
  }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: mockBom,
  }),
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({
    issues: mockIssues,
  }),
}));

vi.mock('@/lib/stream-resilience', () => ({
  resilientStreamFetch: vi.fn().mockResolvedValue(undefined),
  StreamServerError: class StreamServerError extends Error {},
}));

import DesignAgentPanel from '@/components/panels/chat/DesignAgentPanel';

describe('DesignAgentPanel', () => {
  beforeEach(() => {
    mockAuth.sessionId = 'session-1';
    mockAuth.connectionStatus = 'connected';
    mockSafety.enabled = true;
    mockReview.stats.pending = 0;
    mockReview.threshold = 50;
  });

  it('shows session-required trust guidance and keeps run disabled without a session', () => {
    mockAuth.sessionId = null;

    render(
      <DesignAgentPanel
        projectId={1}
        apiKey="********"
        apiKeyValid={true}
        previewAiChanges={true}
      />,
    );

    fireEvent.change(screen.getByTestId('agent-description-input'), {
      target: { value: 'Build a simple motor driver' },
    });

    expect(screen.getByTestId('trust-receipt-design-agent')).toHaveTextContent('Session required');
    expect(screen.getByTestId('agent-run-button')).toBeDisabled();
  });

  it('shows review-first guidance and enables the run button when safeguards are active', () => {
    render(
      <DesignAgentPanel
        projectId={1}
        apiKey="********"
        apiKeyValid={true}
        previewAiChanges={true}
      />,
    );

    fireEvent.change(screen.getByTestId('agent-description-input'), {
      target: { value: 'Build a simple motor driver' },
    });

    expect(screen.getByTestId('release-confidence-panel')).toHaveTextContent('AI Project Readiness Confidence');
    expect(screen.getByTestId('trust-receipt-design-agent')).toHaveTextContent('Review-first');
    expect(screen.getByTestId('agent-run-button')).toBeEnabled();
  });

  it('warns when the agent would apply changes directly', () => {
    mockSafety.enabled = false;

    render(
      <DesignAgentPanel
        projectId={1}
        apiKey="********"
        apiKeyValid={true}
        previewAiChanges={false}
      />,
    );

    expect(screen.getByTestId('trust-receipt-design-agent')).toHaveTextContent('Direct apply');
  });

  it('hydrates the description from a seeded prompt', () => {
    const consumeSeed = vi.fn();

    render(
      <DesignAgentPanel
        projectId={1}
        apiKey="********"
        apiKeyValid={true}
        previewAiChanges={true}
        seedPrompt="Plan a cleaner breadboard layout for the rover controller."
        onConsumeSeed={consumeSeed}
      />,
    );

    expect(screen.getByTestId('agent-description-input')).toHaveValue(
      'Plan a cleaner breadboard layout for the rover controller.',
    );
    expect(consumeSeed).toHaveBeenCalledTimes(1);
  });
});
