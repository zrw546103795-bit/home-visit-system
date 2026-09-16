import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../database/schema';
import { DRIZZLE_DATABASE } from '../platform-shim';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DATABASE,
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/home_visit';
        const client = postgres(databaseUrl);
        const db = drizzle(client, { schema });
        return db;
      },
    },
  ],
  exports: [DRIZZLE_DATABASE],
})
export class DatabaseModule {}
