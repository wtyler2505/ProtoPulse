import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  LAST_RADIAL_AI_COMMAND_EVENT,
  RADIAL_AI_CHAT_DRAFT_EVENT,
  buildRadialAiPrompt,
  clearLastRadialAiCommandForTests,
  dispatchRadialAiPrompt,
  getLastRadialAiCommand,
  repeatLastRadialAiCommand,
  runRadialAiCommand,
  subscribeLastRadialAiCommand,
} from '@/lib/radial-ai-commands';
import { clearRadialTelemetry, readRadialTelemetry } from '@/lib/radial-menu-telemetry';

describe('radial-ai-commands', () => {
  afterEach(() => {
    clearLastRadialAiCommandForTests();
    clearRadialTelemetry();
    vi.restoreAllMocks();
  });

  it('builds a contextual radial AI prompt with target details and sections', () => {
    const prompt = buildRadialAiPrompt({
      intent: 'fix_issue',
      intro: 'Explain and fix this validation issue.',
      summary: 'Validation issue: Missing ESD protection.',
      context: {
        view: 'validation',
        target: 'issue',
        targetId: 'arch:10',
        targetLabel: 'Missing ESD',
        pointer: { x: 120.4, y: 88.6 },
      },
      targetDetails: ['Severity: warning', 'Component: USB'],
      sections: [{ title: 'Rule context', lines: ['ESD parts should protect exposed ports.'] }],
    });

    expect(prompt).toContain('AI intent: fix_issue.');
    expect(prompt).toContain('Validation issue: Missing ESD protection.');
    expect(prompt).toContain('Target: issue "Missing ESD"');
    expect(prompt).toContain('Target id: arch:10');
    expect(prompt).toContain('Pointer: 120, 89');
    expect(prompt).toContain('- Severity: warning');
    expect(prompt).toContain('Rule context:');
  });

  it('opens chat and dispatches a visible chat draft without sending', () => {
    const openSpy = vi.fn();
    const draftSpy = vi.fn();
    const sendSpy = vi.fn();
    const addMessage = vi.fn();
    window.addEventListener('protopulse:open-chat-panel', openSpy);
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);
    window.addEventListener('protopulse:chat-send', sendSpy);

    dispatchRadialAiPrompt({ message: 'Explain this target.', addMessage });

    expect(addMessage).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect((openSpy.mock.calls[0]?.[0] as CustomEvent<{ designAgent?: boolean }>).detail.designAgent).toBe(false);
    expect(draftSpy).toHaveBeenCalledTimes(1);
    expect((draftSpy.mock.calls[0]?.[0] as CustomEvent<{ message: string; source: string; delivery: string }>).detail).toEqual({
      message: 'Explain this target.',
      source: 'radial-ai',
      delivery: 'draft',
    });
    expect(sendSpy).not.toHaveBeenCalled();

    window.removeEventListener('protopulse:open-chat-panel', openSpy);
    window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);
    window.removeEventListener('protopulse:chat-send', sendSpy);
  });

  it('opens chat and dispatches send-now prompts without drafting', () => {
    const openSpy = vi.fn();
    const draftSpy = vi.fn();
    const sendSpy = vi.fn();
    window.addEventListener('protopulse:open-chat-panel', openSpy);
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);
    window.addEventListener('protopulse:chat-send', sendSpy);

    dispatchRadialAiPrompt({ message: 'Send this immediately.', delivery: 'send-now' });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(draftSpy).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect((sendSpy.mock.calls[0]?.[0] as CustomEvent<{ message: string; source: string; delivery: string }>).detail).toEqual({
      message: 'Send this immediately.',
      source: 'radial-ai',
      delivery: 'send-now',
    });

    window.removeEventListener('protopulse:open-chat-panel', openSpy);
    window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);
    window.removeEventListener('protopulse:chat-send', sendSpy);
  });

  it('builds and drafts in one command helper call', () => {
    const draftSpy = vi.fn();
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);

    const message = runRadialAiCommand({
      intent: 'summarize_tradeoffs',
      intro: 'Summarize sourcing tradeoffs.',
      summary: 'BOM part: ESP32-S3.',
    });

    expect(message).toContain('AI intent: summarize_tradeoffs.');
    expect(draftSpy).toHaveBeenCalledTimes(1);
    expect((draftSpy.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message).toBe(message);
    expect(getLastRadialAiCommand()).toEqual(expect.objectContaining({
      intent: 'summarize_tradeoffs',
      label: 'Summarize Tradeoffs',
      message,
    }));

    window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);
  });

  it('records and repeats the most recent radial AI command', () => {
    const draftSpy = vi.fn();
    const changeSpy = vi.fn();
    const subscriber = vi.fn();
    const unsubscribe = subscribeLastRadialAiCommand(subscriber);
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);
    window.addEventListener(LAST_RADIAL_AI_COMMAND_EVENT, changeSpy);

    const message = runRadialAiCommand({
      intent: 'fix_issue',
      intro: 'Explain this validation issue.',
      summary: 'Validation issue: Missing ESD.',
      historyLabel: 'Fix issue: Missing ESD',
      context: {
        view: 'validation',
        target: 'issue',
        targetId: 'arch:10',
        targetLabel: 'Missing ESD',
      },
    });
    const firstCommand = getLastRadialAiCommand();

    expect(firstCommand).toEqual(expect.objectContaining({
      intent: 'fix_issue',
      label: 'Fix issue: Missing ESD',
      summary: 'Validation issue: Missing ESD.',
      message,
    }));
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect((changeSpy.mock.calls[0]?.[0] as CustomEvent<{ command: unknown }>).detail.command).toEqual(firstCommand);

    const repeated = repeatLastRadialAiCommand();

    expect(repeated).toEqual(firstCommand);
    expect(draftSpy).toHaveBeenCalledTimes(2);
    expect((draftSpy.mock.calls[1]?.[0] as CustomEvent<{ message: string }>).detail.message).toBe(message);
    expect(subscriber).toHaveBeenCalledTimes(2);

    unsubscribe();
    window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);
    window.removeEventListener(LAST_RADIAL_AI_COMMAND_EVENT, changeSpy);
  });

  it('records bounded telemetry for drafted radial AI prompts', () => {
    const message = runRadialAiCommand({
      intent: 'review_pcb',
      intro: 'Review this selected footprint.',
      summary: 'PCB review: selected U1 footprint with routing and clearance risks that need manual inspection.',
      context: {
        view: 'pcb',
        target: 'node',
        targetId: '101',
        targetLabel: 'U1',
      },
    });

    const aiDraft = readRadialTelemetry().find((event) => event.name === 'ai-draft');

    expect(aiDraft).toMatchObject({
      name: 'ai-draft',
      view: 'pcb',
      target: 'node',
      commandId: 'review_pcb',
      intent: 'review_pcb',
      promptChars: message.length,
    });
    expect(aiDraft?.reason).toHaveLength(80);
    expect(aiDraft?.reason).toContain('PCB review');
    expect(aiDraft?.reason?.endsWith('...')).toBe(true);
  });

  it('records separate telemetry for send-now radial AI prompts', () => {
    const sendSpy = vi.fn();
    window.addEventListener('protopulse:chat-send', sendSpy);

    const message = runRadialAiCommand({
      intent: 'starter_learn',
      intro: 'Explain this starter circuit.',
      summary: 'Starter learning prompt: Blink.',
      delivery: 'send-now',
      context: {
        view: 'starter_circuits',
        target: 'starter_circuit',
        targetId: 'blink',
        targetLabel: 'Blink',
      },
    });

    const aiSend = readRadialTelemetry().find((event) => event.name === 'ai-send-now');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(aiSend).toMatchObject({
      name: 'ai-send-now',
      view: 'starter_circuits',
      target: 'starter_circuit',
      commandId: 'starter_learn',
      intent: 'starter_learn',
      promptChars: message.length,
    });

    window.removeEventListener('protopulse:chat-send', sendSpy);
  });
});
