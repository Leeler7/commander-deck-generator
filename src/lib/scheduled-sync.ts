import { serverCardDatabase } from './server-card-database';

/**
 * Scheduled Sync Service
 * 
 * Handles automatic background syncing of the card database
 */

let syncInterval: NodeJS.Timeout | null = null;

/**
 * Start the scheduled sync service
 * Checks every 6 hours and syncs if the database is more than 24 hours old
 */
export function startScheduledSync() {
  if (syncInterval) {
    console.log('Scheduled sync already running');
    return;
  }

  console.log('Starting scheduled sync service...');
  
  // Check every 6 hours (6 * 60 * 60 * 1000 = 21600000ms)
  syncInterval = setInterval(async () => {
    try {
      await serverCardDatabase.initialize();
      
      if (serverCardDatabase.needsSync()) {
        const status = serverCardDatabase.getStatus();
        
        // Don't start if sync is already in progress
        if (!status.sync_in_progress) {
          console.log('Starting scheduled database sync...');
          await serverCardDatabase.performFullSync();
          console.log('Scheduled database sync completed');
        } else {
          console.log('Skipping scheduled sync - sync already in progress');
        }
      } else {
        console.log('Database is up to date, no sync needed');
      }
    } catch (error) {
      console.error('Scheduled sync failed:', error);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours
}

/**
 * Stop the scheduled sync service
 */
export function stopScheduledSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('Scheduled sync service stopped');
  }
}

// Auto-start when this module is imported on server side
if (typeof window === 'undefined') {
  // Start after a short delay to allow app to initialize
  setTimeout(() => {
    startScheduledSync();
  }, 5000); // 5 seconds delay
}