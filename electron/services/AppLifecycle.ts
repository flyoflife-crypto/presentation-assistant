import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  shell,
} from 'electron';
import path from 'path';
import { eventBus } from './EventBus';
import { SessionState, LiveInputMode } from '../ipc/contracts';

/**
 * Window types supported by the application
 */
export enum WindowType {
  SETTINGS = 'settings',
  CAPTION_FEED = 'captionFeed',
  PREP_CHAT = 'prepChat',
  TELEPROMPTER = 'teleprompter',
  GAZE_TRAINER = 'gazeTrainer',
  ROOM_MIC_CAPTURE = 'roomMicCapture',
}

/**
 * Application state indicators for tray menu
 */
interface AppState {
  captionIngestActive: boolean;
  roomMicActive: boolean;
  cameraActive: boolean;
  teleprompterActive: boolean;
}

/**
 * AppLifecycle - Manages application lifecycle, windows, and system integration
 * Singleton service that handles:
 * - Single instance enforcement
 * - Tray/Menu bar management with dynamic status indicators
 * - Window lifecycle (create, track, destroy)
 * - Global shortcuts
 * - App event handlers
 */
class AppLifecycle {
  private static instance: AppLifecycle;
  private windows: Map<WindowType, BrowserWindow>;
  private tray: Tray | null;
  private preloadPath: string;
  private rendererPath: string;
  private appState: AppState;
  private isQuitting: boolean;

  private constructor() {
    this.windows = new Map();
    this.tray = null;
    this.preloadPath = path.join(__dirname, '../preload.js');
    this.rendererPath = path.join(__dirname, '../../dist/renderer');
    this.appState = {
      captionIngestActive: false,
      roomMicActive: false,
      cameraActive: false,
      teleprompterActive: false,
    };
    this.isQuitting = false;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AppLifecycle {
    if (!AppLifecycle.instance) {
      AppLifecycle.instance = new AppLifecycle();
    }
    return AppLifecycle.instance;
  }

  /**
   * Initialize the application lifecycle
   * Must be called during app 'ready' event
   */
  public async initialize(): Promise<void> {
    // Enforce single instance
    this.enforceSingleInstance();

    // Setup tray icon
    this.setupTray();

    // Setup global shortcuts
    this.setupGlobalShortcuts();

    // Setup event listeners
    this.setupEventListeners();

    // Setup app event handlers
    this.setupAppEventHandlers();

    console.log('[AppLifecycle] Initialized successfully');
    eventBus.emit('app:ready', undefined);
  }

  /**
   * Enforce single instance lock
   */
  private enforceSingleInstance(): void {
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      console.log('[AppLifecycle] Another instance is running, quitting...');
      app.quit();
      return;
    }

    app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
      console.log('[AppLifecycle] Second instance detected, focusing existing windows');
      
      // Focus the settings window or create it if none exist
      const settingsWindow = this.windows.get(WindowType.SETTINGS);
      if (settingsWindow) {
        if (settingsWindow.isMinimized()) settingsWindow.restore();
        settingsWindow.focus();
      } else {
        this.createSettingsWindow();
      }
    });
  }

  /**
   * Setup tray icon with menu
   */
  private setupTray(): void {
    // Create a simple icon (you can replace with actual icon file)
    const icon = this.createTrayIcon();
    this.tray = new Tray(icon);
    this.tray.setToolTip('Presentation Assistant Pro');

    // Build and set context menu
    this.updateTrayMenu();

    // Double click to open settings
    this.tray.on('double-click', () => {
      this.getOrCreateWindow(WindowType.SETTINGS);
    });
  }

  /**
   * Create a simple tray icon
   * TODO: Replace with actual icon file from assets
   */
  private createTrayIcon(): Electron.NativeImage {
    // Create a simple 16x16 icon
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);
    
    // Fill with a simple pattern (gray square)
    for (let i = 0; i < canvas.length; i += 4) {
      canvas[i] = 100;     // R
      canvas[i + 1] = 100; // G
      canvas[i + 2] = 100; // B
      canvas[i + 3] = 255; // A
    }

    return nativeImage.createFromBuffer(canvas, {
      width: size,
      height: size,
    });
  }

  /**
   * Update tray menu with current state
   */
  private updateTrayMenu(): void {
    if (!this.tray) return;

    const { captionIngestActive, roomMicActive, cameraActive, teleprompterActive } = this.appState;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Presentation Assistant Pro',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: `Captions: ${captionIngestActive ? '🟢 ON' : '⚫ OFF'}`,
        enabled: false,
      },
      {
        label: `Room Mic: ${roomMicActive ? '🟢 ON' : '⚫ OFF'}`,
        enabled: false,
      },
      {
        label: `Camera: ${cameraActive ? '🟢 ON' : '⚫ OFF'}`,
        enabled: false,
      },
      {
        label: `Teleprompter: ${teleprompterActive ? '🟢 ON' : '⚫ OFF'}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => this.getOrCreateWindow(WindowType.SETTINGS),
      },
      {
        label: 'Caption Feed',
        click: () => this.getOrCreateWindow(WindowType.CAPTION_FEED),
      },
      {
        label: 'Prep Chat',
        click: () => this.getOrCreateWindow(WindowType.PREP_CHAT),
      },
      {
        label: 'Teleprompter',
        click: () => this.getOrCreateWindow(WindowType.TELEPROMPTER),
      },
      {
        label: 'Gaze Trainer',
        click: () => this.getOrCreateWindow(WindowType.GAZE_TRAINER),
      },
      {
        label: 'Room Mic Capture',
        click: () => this.getOrCreateWindow(WindowType.ROOM_MIC_CAPTURE),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.isQuitting = true;
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Setup global shortcuts
   */
  private setupGlobalShortcuts(): void {
    // Toggle teleprompter (Cmd+Shift+T on macOS)
    globalShortcut.register('CommandOrControl+Shift+T', () => {
      const teleprompterWindow = this.windows.get(WindowType.TELEPROMPTER);
      if (teleprompterWindow) {
        if (teleprompterWindow.isVisible()) {
          teleprompterWindow.hide();
        } else {
          teleprompterWindow.show();
        }
      } else {
        this.createTeleprompterWindow();
      }
    });

    // Quick access to settings (Cmd+,)
    globalShortcut.register('CommandOrControl+,', () => {
      this.getOrCreateWindow(WindowType.SETTINGS);
    });

    console.log('[AppLifecycle] Global shortcuts registered');
  }

  /**
   * Setup event listeners from EventBus
   */
  private setupEventListeners(): void {
    // Listen for caption status changes
    eventBus.on('caption:ingested', () => {
      if (!this.appState.captionIngestActive) {
        this.appState.captionIngestActive = true;
        this.updateTrayMenu();
      }
    });

    // Listen for audio events
    eventBus.on('audio:started', () => {
      this.appState.roomMicActive = true;
      this.updateTrayMenu();
    });

    eventBus.on('audio:stopped', () => {
      this.appState.roomMicActive = false;
      this.updateTrayMenu();
    });

    // Listen for session state changes
    eventBus.on('session:state-changed', ({ state, mode }) => {
      if (state === SessionState.IDLE || state === SessionState.STOPPING) {
        this.appState.captionIngestActive = false;
        this.appState.roomMicActive = false;
        this.appState.teleprompterActive = false;
      } else if (state === SessionState.LIVE) {
        if (mode === LiveInputMode.CAPTIONS) {
          this.appState.captionIngestActive = true;
        } else if (mode === LiveInputMode.ROOM_MIC) {
          this.appState.roomMicActive = true;
        }
      }
      this.updateTrayMenu();
    });

    // Listen for hint events to track teleprompter activity
    eventBus.on('hint:displayed', () => {
      this.appState.teleprompterActive = true;
      this.updateTrayMenu();
    });

    eventBus.on('hint:expired', () => {
      this.appState.teleprompterActive = false;
      this.updateTrayMenu();
    });
  }

  /**
   * Setup app event handlers
   */
  private setupAppEventHandlers(): void {
    // Handle window-all-closed
    app.on('window-all-closed', () => {
      // On macOS, don't quit - keep running in tray
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle activate (macOS)
    app.on('activate', () => {
      // On macOS, re-create window when dock icon is clicked and no windows open
      if (this.windows.size === 0) {
        this.createSettingsWindow();
      }
    });

    // Handle before-quit
    app.on('before-quit', () => {
      this.isQuitting = true;
      this.cleanup();
    });

    // Handle will-quit
    app.on('will-quit', () => {
      // Unregister all shortcuts
      globalShortcut.unregisterAll();
    });
  }

  /**
   * Get or create a window by type
   */
  public getOrCreateWindow(type: WindowType): BrowserWindow {
    const existingWindow = this.windows.get(type);
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.show();
      existingWindow.focus();
      return existingWindow;
    }

    // Create new window based on type
    switch (type) {
      case WindowType.SETTINGS:
        return this.createSettingsWindow();
      case WindowType.CAPTION_FEED:
        return this.createCaptionFeedWindow();
      case WindowType.PREP_CHAT:
        return this.createPrepChatWindow();
      case WindowType.TELEPROMPTER:
        return this.createTeleprompterWindow();
      case WindowType.GAZE_TRAINER:
        return this.createGazeTrainerWindow();
      case WindowType.ROOM_MIC_CAPTURE:
        return this.createRoomMicCaptureWindow();
      default:
        throw new Error(`Unknown window type: ${type}`);
    }
  }

  /**
   * Get window by type (returns null if doesn't exist)
   */
  public getWindow(type: WindowType): BrowserWindow | null {
    const window = this.windows.get(type);
    return window && !window.isDestroyed() ? window : null;
  }

  /**
   * Create Settings Window
   */
  private createSettingsWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 600,
      minHeight: 400,
      title: 'Settings - Presentation Assistant',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.preloadPath,
      },
      show: false,
    });

    this.setupWindow(window, WindowType.SETTINGS, 'settings.html');
    return window;
  }

  /**
   * Create Caption Feed Window
   */
  private createCaptionFeedWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 600,
      height: 400,
      minWidth: 400,
      minHeight: 300,
      title: 'Caption Feed - Presentation Assistant',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.preloadPath,
      },
      show: false,
    });

    this.setupWindow(window, WindowType.CAPTION_FEED, 'captionFeed.html');
    return window;
  }

  /**
   * Create Prep Chat Window
   */
  private createPrepChatWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 700,
      height: 500,
      minWidth: 500,
      minHeight: 400,
      title: 'Prep Chat - Presentation Assistant',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.preloadPath,
      },
      show: false,
    });

    this.setupWindow(window, WindowType.PREP_CHAT, 'prepChat.html');
    return window;
  }

  /**
   * Create Teleprompter Window
   */
  private createTeleprompterWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 400,
      height: 200,
      minWidth: 300,
      minHeight: 100,
      title: 'Teleprompter - Presentation Assistant',
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.preloadPath,
      },
      show: false,
    });

    this.setupWindow(window, WindowType.TELEPROMPTER, 'teleprompter.html');
    return window;
  }

  /**
   * Create Gaze Trainer Window
   */
  private createGazeTrainerWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 640,
      minHeight: 480,
      title: 'Gaze Trainer - Presentation Assistant',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.preloadPath,
      },
      show: false,
    });

    this.setupWindow(window, WindowType.GAZE_TRAINER, 'gazeTrainer.html');
    return window;
  }

  /**
   * Create Room Mic Capture Window
   */
  private createRoomMicCaptureWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 500,
      height: 300,
      minWidth: 400,
      minHeight: 250,
      title: 'Room Mic Capture - Presentation Assistant',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.preloadPath,
      },
      show: false,
    });

    this.setupWindow(window, WindowType.ROOM_MIC_CAPTURE, 'roomMicCapture.html');
    return window;
  }

  /**
   * Common window setup logic
   */
  private setupWindow(window: BrowserWindow, type: WindowType, htmlFile: string): void {
    // Track window
    this.windows.set(type, window);

    // Load HTML file
    const htmlPath = path.join(this.rendererPath, htmlFile);
    window.loadFile(htmlPath).catch(err => {
      console.error(`[AppLifecycle] Failed to load ${htmlFile}:`, err);
      eventBus.emit('app:error', { error: err, context: `Loading ${htmlFile}` });
    });

    // Show window when ready
    window.once('ready-to-show', () => {
      window.show();
    });

    // Handle window close
    window.on('close', (event) => {
      if (!this.isQuitting && process.platform === 'darwin') {
        // On macOS, hide instead of close unless quitting
        event.preventDefault();
        window.hide();
      }
    });

    // Handle window closed (actual destruction)
    window.on('closed', () => {
      this.windows.delete(type);
      console.log(`[AppLifecycle] Window closed: ${type}`);
    });

    // Open external links in browser
    window.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    console.log(`[AppLifecycle] Window created: ${type}`);
  }

  /**
   * Close a specific window
   */
  public closeWindow(type: WindowType): void {
    const window = this.windows.get(type);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  /**
   * Close all windows
   */
  public closeAllWindows(): void {
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.windows.clear();
  }

  /**
   * Show a window (create if doesn't exist)
   */
  public showWindow(type: WindowType): BrowserWindow {
    return this.getOrCreateWindow(type);
  }

  /**
   * Hide a window
   */
  public hideWindow(type: WindowType): void {
    const window = this.windows.get(type);
    if (window && !window.isDestroyed()) {
      window.hide();
    }
  }

  /**
   * Update app state and tray
   */
  public updateState(state: Partial<AppState>): void {
    this.appState = { ...this.appState, ...state };
    this.updateTrayMenu();
  }

  /**
   * Get current app state
   */
  public getState(): AppState {
    return { ...this.appState };
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    console.log('[AppLifecycle] Cleaning up...');
    
    // Destroy tray
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }

    // Close all windows
    this.closeAllWindows();

    // Emit shutdown event
    eventBus.emit('app:shutdown', undefined);
  }

  /**
   * Get all open windows
   */
  public getOpenWindows(): Map<WindowType, BrowserWindow> {
    // Filter out destroyed windows
    const openWindows = new Map<WindowType, BrowserWindow>();
    this.windows.forEach((window, type) => {
      if (!window.isDestroyed()) {
        openWindows.set(type, window);
      }
    });
    return openWindows;
  }
}

// Export class for typing
export { AppLifecycle };

// Singleton instance
export const appLifecycle = AppLifecycle.getInstance();
export default appLifecycle;
