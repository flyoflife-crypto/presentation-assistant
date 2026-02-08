import { app, ipcMain, BrowserWindow } from 'electron';
import { appLifecycle, WindowType } from './services/AppLifecycle';
import { eventBus } from './services/EventBus';
import { IPCChannel } from './ipc/contracts';

/**
 * Main process entry point
 * Initializes the application and sets up IPC handlers
 */

// Handle app ready event
app.whenReady().then(async () => {
  console.log('[Main] App ready, initializing...');
  
  // Initialize AppLifecycle
  await appLifecycle.initialize();
  
  // Setup IPC handlers
  setupIPCHandlers();
  
  // Create initial settings window
  appLifecycle.showWindow(WindowType.SETTINGS);
  
  console.log('[Main] Initialization complete');
});

/**
 * Setup IPC handlers for window management
 */
function setupIPCHandlers(): void {
  // Window management
  ipcMain.handle(IPCChannel.WINDOW_OPEN_SETTINGS, () => {
    appLifecycle.showWindow(WindowType.SETTINGS);
  });

  ipcMain.handle(IPCChannel.WINDOW_OPEN_CAPTION_FEED, () => {
    appLifecycle.showWindow(WindowType.CAPTION_FEED);
  });

  ipcMain.handle(IPCChannel.WINDOW_OPEN_PREP_CHAT, () => {
    appLifecycle.showWindow(WindowType.PREP_CHAT);
  });

  ipcMain.handle(IPCChannel.WINDOW_OPEN_POST_ANALYSIS, () => {
    // Post analysis window not yet implemented - could be a special mode
    console.log('[Main] Post Analysis window requested (not yet implemented)');
  });

  ipcMain.handle(IPCChannel.WINDOW_CLOSE, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.close();
    }
  });

  console.log('[Main] IPC handlers registered');
}

// Handle any uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
  eventBus.emit('app:error', { error, context: 'Uncaught exception' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason);
  eventBus.emit('app:error', {
    error: reason instanceof Error ? reason : new Error(String(reason)),
    context: 'Unhandled rejection',
  });
});
