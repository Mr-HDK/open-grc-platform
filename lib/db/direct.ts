import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __openGrcDirectPool: Pool | undefined;
}

function getDirectDatabaseUrl() {
  const connectionString = process.env.DIRECT_URL;

  if (!connectionString) {
    throw new Error("Missing DIRECT_URL environment variable.");
  }

  return connectionString;
}

export function getDirectPool() {
  if (!global.__openGrcDirectPool) {
    global.__openGrcDirectPool = new Pool({
      connectionString: getDirectDatabaseUrl(),
    });
  }

  return global.__openGrcDirectPool;
}

export async function queryDirect<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return getDirectPool().query<T>(text, values);
}
