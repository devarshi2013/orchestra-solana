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

let client: ReturnType<typeof createPrismaClient> | undefined;

/** The client, created on first use (so importing this module needs no DATABASE_URL). */
function getClient() {
  if (client) return client;
  const cached = globalForPrisma.prismaClass === PrismaClient ? globalForPrisma.prisma : undefined;
  if (!cached) void globalForPrisma.prisma?.$disconnect();
  client = cached ?? createPrismaClient();
  if (serverEnv.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaClass = PrismaClient;
  }
  return client;
}

export const db = new Proxy({} as ReturnType<typeof createPrismaClient>, {
  get(_target, key) {
    const real = getClient();
    const value = Reflect.get(real, key, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
