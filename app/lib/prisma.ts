import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getSqlitePathFromEnv(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!url.startsWith("file:")) {
    throw new Error('DATABASE_URL must start with "file:" for SQLite');
  }

  const filePath = url.slice("file:".length);
  if (!filePath) throw new Error('DATABASE_URL missing path after "file:"');

  // Avoid path.resolve/join here so Turbopack doesn't trace the whole project.
  // `better-sqlite3` accepts relative paths, resolved from the process working directory.
  return filePath;
}

function createPrismaClient() {
  const sqlitePath = getSqlitePathFromEnv(process.env.DATABASE_URL);
  const adapter = new PrismaBetterSqlite3({ url: sqlitePath });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

