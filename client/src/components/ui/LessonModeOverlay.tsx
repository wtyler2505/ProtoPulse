/**
 * LessonModeOverlay — full-screen overlay that dims and disables
 * UI controls not in the lesson's allowed list.
 *
 * When lesson mode is active this component:
 *   1. Renders a semi-transparent backdrop over the entire viewport.
 *   2. "Cuts out" allowed controls by elevating their z-index and
 *      pointer-events so they remain interactive.
 *   3. Shows a small banner at the top with the lesson hint and
 *      an exit button.
 *
 * Strategy: rather than cloning the DOM, we use a MutationObserver
 * + querySelectorAll to tag allowed elements with an inline style
 * that lifts them above the overlay. The overlay itself sits at a
 * high z-index and absorbs pointer events for everything else.
 */

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLessonMode } from '@/lib/lesson-mode';

const OVERLAY_Z = 9998;
const ALLOWED_Z = 9999;
const BANNER_Z = 10000;

// CSS class applied to elements that are "allowed" during lesson mode
const ALLOWED_CLASS = 'lesson-mode-allowed';

export default function LessonModeOverlay() {
  const { active, allowedSelectors, hint, disable } = useLessonMode();
  const observerRef = useRef<MutationObserver | null>(null);
  const previouslyTagged = useRef<Set<Element>>(new Set());

  const tagAllowedElements = useCallback(() => {
    // Remove tags from previously tagged elements
    Array.from(previouslyTagged.current).forEach((el) => {
      el.classList.remove(ALLOWED_CLASS);
      if (el instanceof HTMLElement) {
        el.style.removeProperty('position');
        el.style.removeProperty('z-index');
        el.style.removeProperty('pointer-events');
      }
    });
    previouslyTagged.current = new Set();

    if (!active || allowedSelectors.length === 0) {
      return;
    }

    for (const selector of allowedSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          el.classList.add(ALLOWED_CLASS);
          if (el instanceof HTMLElement) {
            el.style.position = 'relative';
            el.style.zIndex = String(ALLOWED_Z);
            el.style.pointerEvents = 'auto';
          }
          previouslyTagged.current.add(el);
        });
      } catch {
        // Invalid CSS selector — skip silently
      }
    }
  }, [active, allowedSelectors]);

  // Tag elements when selectors change and observe DOM mutations
  useEffect(() => {
    tagAllowedElements();

    if (!active) {
      return;
    }

    // Re-tag when DOM changes (e.g. lazy-loaded views mount)
    observerRef.current = new MutationObserver(() => {
      tagAllowedElements();
    });
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      // Cleanup all tags
      Array.from(previouslyTagged.current).forEach((el) => {
        el.classList.remove(ALLOWED_CLASS);
        if (el instanceof HTMLElement) {
          el.style.removeProperty('position');
          el.style.removeProperty('z-index');
          el.style.removeProperty('pointer-events');
        }
      });
      previouslyTagged.current = new Set();
    };
  }, [active, tagAllowedElements]);

  if (!active) {
    return null;
  }

  return createPortal(
    <>
      {/* Semi-transparent backdrop — absorbs clicks on non-allowed elements */}
      <div
        data-testid="lesson-mode-overlay"
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: OVERLAY_Z,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          pointerEvents: 'auto',
        }}
      />

      {/* Top banner with hint + exit */}
      <div
        data-testid="lesson-mode-banner"
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: BANNER_Z,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '8px 16px',
          backgroundColor: 'rgba(0, 240, 255, 0.15)',
          borderBottom: '1px solid rgba(0, 240, 255, 0.3)',
          backdropFilter: 'blur(8px)',
          color: '#00F0FF',
          fontSize: '14px',
          fontWeight: 500,
          pointerEvents: 'auto',
        }}
      >
        <GraduationCap style={{ width: 18, height: 18, flexShrink: 0 }} />
        <span data-testid="lesson-mode-hint">
          {hint ?? 'Lesson mode active — only highlighted controls are available'}
        </span>
        <Button
          data-testid="lesson-mode-exit"
          variant="ghost"
          size="sm"
          onClick={disable}
          aria-label="Exit lesson mode"
          style={{
            marginLeft: 'auto',
            color: '#00F0FF',
            border: '1px solid rgba(0, 240, 255, 0.3)',
          }}
        >
          <X style={{ width: 14, height: 14, marginRight: 4 }} />
          Exit
        </Button>
      </div>
    </>,
    document.body,
  );
}
