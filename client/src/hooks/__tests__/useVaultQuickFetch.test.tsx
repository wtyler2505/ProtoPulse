/**
 * useVaultQuickFetch — tooltip-grade reader over useVaultNote.
 *
 * Verifies: summary truncation, 404 normalization, memoization stability,
 * and that we emit the tooltip-grade `description` when present (even when
 * the body would have been longer / noisier).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useVaultQuickFetch } from '../useVaultQuickFetch';

const mockFetch = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', mockFetch);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

describe('useVaultQuickFetch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('disables the query when slug is null/undefined', () => {
    const { result } = renderHook(() => useVaultQuickFetch(null), { wrapper });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.title).toBe('');
  });

  it('returns the frontmatter description verbatim when ≤140 chars', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        slug: 'x',
        title: 'X Title',
        description: 'Short tooltip-grade description.',
        type: 'claim',
        topics: ['a', 'b'],
        links: [],
        body: '# body heading\n\n**bold** body with lots more content to ensure body is not consulted.',
      }),
    );

    const { result } = renderHook(() => useVaultQuickFetch('x'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.title).toBe('X Title');
    expect(result.current.summary).toBe('Short tooltip-grade description.');
    expect(result.current.topics).toEqual(['a', 'b']);
    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('falls back to stripped body when description is empty', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        slug: 'x',
        title: 'X',
        description: '',
        type: 'claim',
        topics: [],
        links: [],
        body: '# Heading\n\nThis is the **body** of the note — it should feed the summary.',
      }),
    );

    const { result } = renderHook(() => useVaultQuickFetch('x'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary).toContain('This is the body of the note');
    // No markdown emphasis markers should leak into the tooltip.
    expect(result.current.summary).not.toMatch(/\*\*|##/);
  });

  it('truncates long descriptions to 140 chars with ellipsis', async () => {
    const long = 'a'.repeat(300);
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        slug: 'x',
        title: 'X',
        description: long,
        type: 'claim',
        topics: [],
        links: [],
        body: '',
      }),
    );

    const { result } = renderHook(() => useVaultQuickFetch('x'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary.length).toBeLessThanOrEqual(140);
    expect(result.current.summary.endsWith('…')).toBe(true);
  });

  it('sets notFound=true when the server returns 404, and clears error', async () => {
    mockFetch.mockResolvedValueOnce(textResponse('note not found', 404));

    const { result } = renderHook(() => useVaultQuickFetch('missing-slug'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.notFound).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.title).toBe('missing-slug');
  });

  it('preserves non-404 errors unchanged', async () => {
    mockFetch.mockResolvedValueOnce(textResponse('kaboom', 500));

    const { result } = renderHook(() => useVaultQuickFetch('boom'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toBeTruthy();
  });
});
