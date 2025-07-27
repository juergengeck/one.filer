import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock electron IPC
global.window = {
  ...global.window,
  electronAPI: {
    drive: {
      create: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      getStats: vi.fn(),
      onStatsUpdate: vi.fn(() => () => {}),
    },
    settings: {
      get: vi.fn(),
      set: vi.fn(),
    },
    system: {
      openPath: vi.fn(),
      showItemInFolder: vi.fn(),
    },
    dialog: {
      selectFolder: vi.fn(),
    },
    onNavigate: vi.fn(() => () => {}),
  },
} as any;