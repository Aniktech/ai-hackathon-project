import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const prismaGlobal = globalThis as typeof globalThis & {
  storeCoachPrisma?: PrismaClient;
};

export function getPrismaClient(): PrismaClient {
  if (prismaGlobal.storeCoachPrisma) {
    return prismaGlobal.storeCoachPrisma;
  }

  // Use Neon’s pooled endpoint for Vercel function traffic when configured;
  // DATABASE_URL remains the direct endpoint for Prisma CLI migrations/imports.
  const connectionString = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or DATABASE_URL_POOLED is required before database queries can run.");
  }

  const adapter = new PrismaPg({ connectionString, max: 3, idleTimeoutMillis: 10_000 });
  const client = new PrismaClient({ adapter });
  prismaGlobal.storeCoachPrisma = client;
  return client;
}
