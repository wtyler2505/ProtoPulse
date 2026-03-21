import { describe, it, expect } from 'vitest';

describe('localStorage probe', () => {
  it('checks what localStorage has', () => {
    console.log('type of localStorage:', typeof localStorage);
    console.log('constructor:', localStorage?.constructor?.name);
    console.log('has getItem:', typeof localStorage?.getItem);
    console.log('has setItem:', typeof localStorage?.setItem);
    console.log('has removeItem:', typeof localStorage?.removeItem);
    console.log('has clear:', typeof localStorage?.clear);
    console.log('own keys:', Object.getOwnPropertyNames(localStorage));
    console.log('proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(localStorage) ?? {}));
    expect(true).toBe(true);
  });
});
