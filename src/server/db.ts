import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { serverEnv } from "@/env/server";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: serverEnv.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: serverEnv.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Reuse one client across hot reloads in development, but replace it after
// `prisma generate`: the regenerated module brings a new PrismaClient class,
// and the cached client would otherwise not know the new models and fields.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
  prismaClass?: typeof PrismaClient;
};

const cached = globalForPrisma.prismaClass === PrismaClient ? globalForPrisma.prisma : undefined;
if (!cached) void globalForPrisma.prisma?.$disconnect();

export const db = cached ?? createPrismaClient();

if (serverEnv.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaClass = PrismaClient;
}
