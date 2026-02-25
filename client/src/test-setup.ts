import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Automatic cleanup after each test (removes rendered React trees)
afterEach(() => {
  cleanup();
});
