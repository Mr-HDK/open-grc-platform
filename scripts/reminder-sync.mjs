import fs from "node:fs";
import path from "node:path";

import pg from "pg";

const { Pool } = pg;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, "$1");

    env[key] = value;
  }

  return env;
}

function readProjectEnv() {
  const cwd = process.cwd();
  const fileEnv = {
    ...loadEnvFile(path.join(cwd, ".env")),
    ...loadEnvFile(path.join(cwd, ".env.local")),
  };

  return {
    ...process.env,
    ...fileEnv,
  };
}

async function main() {
  const env = readProjectEnv();

  if (!env.DIRECT_URL) {
    throw new Error("Missing DIRECT_URL environment variable.");
  }

  const pool = new Pool({
    connectionString: env.DIRECT_URL,
  });

  try {
    const result = await pool.query("select public.sync_notification_events($1::uuid) as summary", [
      null,
    ]);

    console.log("Reminder sync complete.");
    console.log(JSON.stringify(result.rows[0]?.summary ?? {}, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
