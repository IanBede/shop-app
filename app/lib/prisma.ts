import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getSqlitePathFromEnv(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!url.startsWith("file:")) {
    throw new Error('DATABASE_URL must start with "file:" for SQLite');
  }

  const filePath = url.slice("file:".length);
  if (!filePath) throw new Error('DATABASE_URL missing path after "file:"');

  // On Vercel, resolve the DB file relative to the deployed project root.
  // Example: DATABASE_URL="file:./shop.db" -> "<cwd>/shop.db"
  if (filePath === "./shop.db" || filePath === "shop.db") {
    return path.join(process.cwd(), "shop.db");
  }

  // For other relative paths, resolve from cwd as well.
  if (!path.isAbsolute(filePath) && !filePath.startsWith("./") && !filePath.startsWith("../")) {
    return path.join(process.cwd(), filePath);
  }
  if (!path.isAbsolute(filePath)) {
    return path.join(process.cwd(), filePath);
  }
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

