import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ExactPartDraftModal from '@/components/views/component-editor/ExactPartDraftModal';

const mockMutateAsync = vi.fn();
const mockUpdateLocalKey = vi.fn();

vi.mock('@/hooks/useApiKeys', () => ({
  STORED_KEY_SENTINEL: '__stored__',
  useApiKeys: () => ({
    apiKey: '',
    updateLocalKey: mockUpdateLocalKey,
  }),
}));

vi.mock('@/lib/component-editor/hooks', () => ({
  useGenerateExactComponentPart: () => ({
    isPending: false,
    mutateAsync: mockMutateAsync,
  }),
}));

describe('ExactPartDraftModal', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockUpdateLocalKey.mockReset();
  });

  it('keeps the Gemini API key input inside a form', () => {
    render(
      <ExactPartDraftModal
        open={true}
        onOpenChange={vi.fn()}
        onCreated={vi.fn()}
        projectId={21}
        initialSeed={undefined}
      />,
    );

    const apiKeyInput = screen.getByTestId('input-exact-part-api-key');
    expect(apiKeyInput.closest('form')).not.toBeNull();
  });

  it('hydrates the request description and source URLs from the provided seed', () => {
    render(
      <ExactPartDraftModal
        open={true}
        initialSeed={{
          description: 'RioRand motor controller with screw terminals and exact silkscreen labels.',
          marketplaceSourceUrl: 'https://www.amazon.com/RioRand-6-60V-Brushless-Electric-Controller/dp/B087M2378D',
        }}
        onOpenChange={vi.fn()}
        onCreated={vi.fn()}
        projectId={21}
      />,
    );

    expect(screen.getByTestId('input-exact-part-description')).toHaveValue(
      'RioRand motor controller with screw terminals and exact silkscreen labels.',
    );
    expect(screen.getByTestId('input-exact-part-marketplace-url')).toHaveValue(
      'https://www.amazon.com/RioRand-6-60V-Brushless-Electric-Controller/dp/B087M2378D',
    );
  });
});
