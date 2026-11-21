import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const prismaGlobal = globalThis as typeof globalThis & {
  storeCoachPrisma?: PrismaClient;
};

export function getPrismaClient(): PrismaClient {
  if (prismaGlobal.storeCoachPrisma) {
    return prismaGlobal.storeCoachPrisma;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required before database queries can run.");
  }

  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    prismaGlobal.storeCoachPrisma = client;
  }

  return client;
}
