import { spawnSync } from "child_process";
import { writeFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";

const host = process.env["SUPABASE_MIG_HOST"];
const port = process.env["SUPABASE_MIG_PORT"];
const db = process.env["SUPABASE_MIG_DB"];
const user = process.env["SUPABASE_MIG_USER"];
const password = process.env["SUPABASE_MIG_PASSWORD"];

if (!host || !port || !db || !user || !password) {
  console.error(
    "ERROR: Missing required SUPABASE_MIG_* environment variables.",
    "This script must be called from migrate-to-supabase.sh."
  );
  process.exit(1);
}

// Build the URL using the URL class so that special characters in the password
// are properly percent-encoded, producing a valid connection string.
const newDatabaseUrl = (() => {
  const url = new URL(`postgresql://${host}/${db}`);
  url.username = user;
  url.password = password;
  url.port = port;
  return url.toString();
})();

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

function findApiServerPid(): number | null {
  for (const pattern of [
    "api-server/dist/index",
    "api-server/src/index",
    "artifacts/api-server",
  ]) {
    const result = spawnSync("pgrep", ["-f", pattern], {
      encoding: "utf-8",
    });
    if (result.status === 0 && result.stdout.trim()) {
      const pid = parseInt(result.stdout.trim().split("\n")[0], 10);
      if (!isNaN(pid)) return pid;
    }
  }
  return null;
}

function restartApiServer(): boolean {
  const pid = findApiServerPid();
  if (!pid) return false;
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

console.log("");
console.log("Step 4/4: Updating app database connection...");

// DATABASE_URL in this Replit environment is runtime-managed by the Helium DB
// service and cannot be overridden via Replit Secrets or environment variable
// APIs from within the container. We write the new URL to .env.local at the
// workspace root; lib/db/src/index.ts reads and applies it before opening the
// pool, which fully replaces the Helium URL on the next server start.
try {
  writeFileSync(envLocalPath, `DATABASE_URL=${newDatabaseUrl}\n`, {
    encoding: "utf-8",
    mode: 0o600,
  });
  console.log(
    `  SUCCESS: Connection string written to .env.local`
  );
  console.log(
    `           Host: ${host}  DB: ${db}  User: ${user}`
  );
  console.log(
    "           The API server will connect to Supabase on next start."
  );
} catch (err) {
  console.error(
    `  ERROR: Could not write .env.local — ${err instanceof Error ? err.message : err}`
  );
  process.exit(1);
}

console.log("");
console.log("  Restarting API server...");

const restarted = restartApiServer();

if (restarted) {
  console.log(
    "  SUCCESS: API server signaled to restart with the new connection."
  );
} else {
  console.log(
    "  INFO: API server process was not found — it may not be running yet."
  );
  console.log(
    "        Start or restart the 'API Server' workflow in Replit to apply"
  );
  console.log("        the new database connection.");
}

console.log("");
console.log("=== Migration complete! ===");
console.log("");
console.log("Your app is now configured to connect to Supabase.");
console.log(
  "Verify your data in the Supabase dashboard, then you may disable"
);
console.log("the Helium database in your Replit project settings.");
