import { dbClient } from '../db/dbClient.js';
import { redisClient } from '../db/redisClient.js';

async function main() {
  console.log('Testing PostgreSQL and Redis connections...');

  // Wait 1.5s for async connection pools to initialize
  await new Promise((r) => setTimeout(r, 1500));

  console.log('Postgres isReady:', dbClient.isReady);
  console.log('Redis isReady:', redisClient.isReady);

  if (redisClient.isReady) {
    await redisClient.setEx('test:greeting', 30, 'Namaste from Redis!');
    const val = await redisClient.get('test:greeting');
    console.log('Redis read result:', val);

    const firstLock = await redisClient.setNx('test:lock:msg123', 30);
    const secondLock = await redisClient.setNx('test:lock:msg123', 30);
    console.log('Redis Lock 1 (expect true):', firstLock);
    console.log('Redis Lock 2 (expect false duplicate):', secondLock);
  }

  if (dbClient.isReady) {
    const employer = await dbClient.getOrCreateEmployer('+919876543210', 'Test Contractor');
    console.log('Postgres Employer:', employer?.phone_number, employer?.full_name);

    const shift = await dbClient.recordConfirmedShift({
      employerPhone: '+919876543210',
      workerPhone: '+919871101001',
      agreedDailyWage: 900
    });
    console.log('Postgres Shift Created:', shift?.shift_id, 'Status:', shift?.status);
  }

  await dbClient.end();
  await redisClient.disconnect();
  console.log('Test completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error in test:', err);
  process.exit(1);
});

