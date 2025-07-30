module.exports = {
  app: {
    getPath: jest.fn((path) => `/mock/path/${path}`),
    setPath: jest.fn(),
    requestSingleInstanceLock: jest.fn(() => true),
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
    setAppUserModelId: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn(),
      openDevTools: jest.fn()
    },
    show: jest.fn(),
    hide: jest.fn(),
    focus: jest.fn(),
    isVisible: jest.fn(() => true),
    isMinimized: jest.fn(() => false),
    restore: jest.fn(),
    setMenu: jest.fn()
  })),
  ipcMain: {
    handle: jest.fn()
  },
  dialog: {
    showMessageBox: jest.fn()
  },
  Tray: jest.fn().mockImplementation(() => ({
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn()
  })),
  Menu: {
    buildFromTemplate: jest.fn()
  },
  nativeImage: {
    createFromPath: jest.fn().mockImplementation(() => ({
      resize: jest.fn().mockReturnThis()
    }))
  }
};