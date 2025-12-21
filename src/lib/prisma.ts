import { PrismaClient } from '@prisma/client';
import { createAdapter } from '@prisma/adapter-postgresql';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = process.env.DATABASE_URL
  ? createAdapter({ connectionString: process.env.DATABASE_URL })
  : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(adapter && { adapter }),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

