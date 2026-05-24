import { drizzle } from "drizzle-orm/node-postgres";
import { existsSync, readFileSync } from "fs";
import pg from "pg";
import { dirname, resolve } from "path";
import * as schema from "./schema";

const { Pool } = pg;

function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

const workspaceRoot = findWorkspaceRoot(process.cwd());
const envLocalPath = resolve(workspaceRoot, ".env.local");

if (existsSync(envLocalPath)) {
  try {
    const contents = readFileSync(envLocalPath, "utf-8");
    const match = contents.match(/^DATABASE_URL=(.+)$/m);
    if (match) {
      process.env["DATABASE_URL"] = match[1].trim();
    }
  } catch {
    // ignore read errors — fall through to normal DATABASE_URL check
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
