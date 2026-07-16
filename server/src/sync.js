import { initDatabase } from './db.js';

initDatabase({ sync: true })
  .then(() => {
    console.log('Database schema synchronized.');
  })
  .catch((error) => {
    console.error('Failed to synchronize database schema:', error);
    process.exitCode = 1;
  });