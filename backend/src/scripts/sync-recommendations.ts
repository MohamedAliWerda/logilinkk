import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { RecommendationsSyncService } from '../recommendations/sync.service';

async function main() {
  const config = new ConfigService(process.env);
  const svc = new RecommendationsSyncService(config);
  try {
    console.log('Starting full recommendations -> MongoDB sync...');
    const res = await svc.fullSyncAllStudents();
    console.log(JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error('Sync failed:', err?.message ?? err);
    process.exitCode = 2;
  } finally {
    await svc.close();
  }
}

if (require.main === module) {
  main();
}
