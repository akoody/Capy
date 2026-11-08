import '../load-env';
import mongoose from 'mongoose';
import { migrateMoney } from '../transactions/money-migration';

/**
 * npm run migrate:money -- --dry-run   показать, что будет перенесено
 * npm run migrate:money                выполнить (сначала сделайте бэкап)
 */
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }
  await mongoose.connect(uri);
  const report = await migrateMoney(mongoose.connection.db!, {
    dryRun: process.argv.includes('--dry-run'),
  });
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
