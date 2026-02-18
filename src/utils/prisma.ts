import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from './dbConfig';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// We use 'as any' here because Prisma 7 with certain configurations 
// may have specialized constructor types that don't match the standard 
// signature, but the underlying JS engine still supports these options.
export const prisma =
  globalForPrisma.prisma ??
  (new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  } as any) as PrismaClient);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
