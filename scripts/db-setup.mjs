import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

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

  // Prefer project env files locally, while still allowing CI-only injected secrets.
  return {
    ...process.env,
    ...fileEnv,
  };
}

function runSupabase(args) {
  const bin = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(bin, ["supabase", ...args], { stdio: "inherit" });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function extractProjectRefFromApiUrl(apiUrl) {
  try {
    const parsed = new URL(apiUrl);
    const match = parsed.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function extractProjectRefFromDirectUrl(dbUrl) {
  try {
    const parsed = new URL(dbUrl);
    const userRefMatch = parsed.username.match(/^postgres\.([a-z0-9-]+)$/i);
    if (userRefMatch) {
      return userRefMatch[1];
    }

    const hostRefMatch = parsed.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
    if (hostRefMatch) {
      return hostRefMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

function assertMatchingProjectRefs(env) {
  const apiRef = extractProjectRefFromApiUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const dbRef = extractProjectRefFromDirectUrl(env.DIRECT_URL);

  if (!apiRef || !dbRef) {
    return;
  }

  if (apiRef !== dbRef) {
    throw new Error(
      `DIRECT_URL project ref (${dbRef}) does not match NEXT_PUBLIC_SUPABASE_URL project ref (${apiRef}). Update DIRECT_URL to target the same Supabase project.`,
    );
  }
}

async function ensureUsersAndRoles(env) {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const usersToEnsure = [
    {
      email: env.E2E_ADMIN_TEST_EMAIL || "admin@open-grc.local",
      password: env.E2E_ADMIN_TEST_PASSWORD || "ChangeMe123!",
      role: "admin",
    },
    {
      email: "manager@open-grc.local",
      password: env.E2E_RISK_TEST_PASSWORD || "ChangeMe123!",
      role: "manager",
    },
    {
      email: env.E2E_RISK_TEST_EMAIL || "contributor@open-grc.local",
      password: env.E2E_RISK_TEST_PASSWORD || "ChangeMe123!",
      role: "contributor",
    },
    {
      email: "viewer@open-grc.local",
      password: env.E2E_RISK_TEST_PASSWORD || "ChangeMe123!",
      role: "viewer",
    },
  ];

  const existingUsersResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existingUsersResult.error) {
    throw new Error(existingUsersResult.error.message);
  }

  const usersByEmail = new Map(
    (existingUsersResult.data.users ?? [])
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user]),
  );

  for (const userSeed of usersToEnsure) {
    const key = userSeed.email.toLowerCase();
    if (usersByEmail.has(key)) {
      continue;
    }

    const created = await supabase.auth.admin.createUser({
      email: userSeed.email,
      password: userSeed.password,
      email_confirm: true,
    });

    if (created.error) {
      throw new Error(`Could not create ${userSeed.email}: ${created.error.message}`);
    }

    if (created.data.user) {
      usersByEmail.set(key, created.data.user);
    }
  }

  for (const userSeed of usersToEnsure) {
    const user = usersByEmail.get(userSeed.email.toLowerCase());
    if (!user) {
      continue;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: userSeed.role })
      .eq("id", user.id);

    if (error) {
      throw new Error(`Could not assign role for ${userSeed.email}: ${error.message}`);
    }
  }
}

async function backfillSeedDependentRows(env) {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { count: actionPlanCount, error: actionCountError } = await supabase
    .from("action_plans")
    .select("*", { count: "exact", head: true });

  if (actionCountError) {
    throw new Error(actionCountError.message);
  }

  const { count: evidenceCount, error: evidenceCountError } = await supabase
    .from("evidence")
    .select("*", { count: "exact", head: true });

  if (evidenceCountError) {
    throw new Error(evidenceCountError.message);
  }

  if ((actionPlanCount ?? 0) > 0 && (evidenceCount ?? 0) > 0) {
    return;
  }

  const { data: ownerRows, error: ownerError } = await supabase
    .from("profiles")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (ownerError) {
    throw new Error(ownerError.message);
  }

  if (!ownerRows?.length) {
    return;
  }

  const ownerId = ownerRows[0].id;

  async function getIdBy(table, column, value) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq(column, value)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data?.id ?? null;
  }

  const refs = {
    riskVuln: await getIdBy("risks", "title", "Delayed vulnerability patching"),
    riskMfa: await getIdBy("risks", "title", "No MFA for legacy VPN users"),
    riskBcp: await getIdBy("risks", "title", "Backup restore process untested"),
    riskChanges: await getIdBy("risks", "title", "Untracked production changes"),
    riskVendor: await getIdBy("risks", "title", "Single approver vendor onboarding"),
    controlVuln: await getIdBy("controls", "code", "VULN-002"),
    controlMfa: await getIdBy("controls", "code", "IAM-001"),
    controlBcp: await getIdBy("controls", "code", "BCP-003"),
    controlChg: await getIdBy("controls", "code", "CHG-005"),
    controlThird: await getIdBy("controls", "code", "THIRD-006"),
  };

  const today = new Date();
  const dateOffset = (days) => {
    const copy = new Date(today);
    copy.setDate(copy.getDate() + days);
    return copy.toISOString().slice(0, 10);
  };

  const actionSeeds = [
    {
      title: "Patch critical CVEs on internet-facing assets",
      description: "Remediate all critical internet-facing CVEs and attach evidence for closure.",
      risk_id: refs.riskVuln,
      control_id: refs.controlVuln,
      owner_profile_id: ownerId,
      status: "in_progress",
      priority: "critical",
      target_date: dateOffset(10),
      created_by: ownerId,
      updated_by: ownerId,
      completed_at: null,
    },
    {
      title: "Enforce MFA on remaining legacy VPN accounts",
      description: "Migrate remaining users to MFA-enabled VPN policies and revoke legacy exceptions.",
      risk_id: refs.riskMfa,
      control_id: refs.controlMfa,
      owner_profile_id: ownerId,
      status: "open",
      priority: "high",
      target_date: dateOffset(14),
      created_by: ownerId,
      updated_by: ownerId,
      completed_at: null,
    },
    {
      title: "Run DR restore drill for tier-1 systems",
      description: "Execute quarterly restore drill and document recovery timings and gaps.",
      risk_id: refs.riskBcp,
      control_id: refs.controlBcp,
      owner_profile_id: ownerId,
      status: "blocked",
      priority: "high",
      target_date: dateOffset(-2),
      created_by: ownerId,
      updated_by: ownerId,
      completed_at: null,
    },
    {
      title: "Close historical change tickets evidence gap",
      description: "Backfill missing links between emergency deployments and approval records.",
      risk_id: refs.riskChanges,
      control_id: refs.controlChg,
      owner_profile_id: ownerId,
      status: "done",
      priority: "medium",
      target_date: dateOffset(-12),
      created_by: ownerId,
      updated_by: ownerId,
      completed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: "Review vendor onboarding SoD exceptions",
      description: "Review and close unresolved segregation-of-duties exceptions in onboarding flow.",
      risk_id: refs.riskVendor,
      control_id: refs.controlThird,
      owner_profile_id: ownerId,
      status: "open",
      priority: "medium",
      target_date: dateOffset(18),
      created_by: ownerId,
      updated_by: ownerId,
      completed_at: null,
    },
  ];

  for (const actionSeed of actionSeeds) {
    const { data: existing, error: findError } = await supabase
      .from("action_plans")
      .select("id")
      .eq("title", actionSeed.title)
      .limit(1)
      .maybeSingle();

    if (findError) {
      throw new Error(findError.message);
    }

    if (existing?.id) {
      continue;
    }

    const { error: insertError } = await supabase.from("action_plans").insert(actionSeed);
    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  const vulnActionPlanId = await getIdBy(
    "action_plans",
    "title",
    "Patch critical CVEs on internet-facing assets",
  );

  const { data: existingEvidence, error: evidenceError } = await supabase
    .from("evidence")
    .select("id")
    .eq("file_path", "seed/vuln-report-q1.pdf")
    .limit(1)
    .maybeSingle();

  if (evidenceError) {
    throw new Error(evidenceError.message);
  }

  if (!existingEvidence?.id) {
    const { error: insertEvidenceError } = await supabase.from("evidence").insert({
      file_name: "vuln-report-q1.pdf",
      file_path: "seed/vuln-report-q1.pdf",
      mime_type: "application/pdf",
      file_size: 120000,
      title: "Quarterly vulnerability report",
      description: "Sample seeded metadata for vulnerability review evidence.",
      risk_id: refs.riskVuln,
      control_id: refs.controlVuln,
      action_plan_id: vulnActionPlanId,
      uploaded_by: ownerId,
    });

    if (insertEvidenceError) {
      throw new Error(insertEvidenceError.message);
    }
  }
}

async function main() {
  const env = readProjectEnv();
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DIRECT_URL"];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  assertMatchingProjectRefs(env);

  console.log("1/4 Apply migrations");
  runSupabase(["db", "push", "--db-url", env.DIRECT_URL, "--yes"]);

  console.log("2/4 Ensure test users and roles");
  await ensureUsersAndRoles(env);

  console.log("3/4 Seed baseline data");
  runSupabase(["db", "push", "--db-url", env.DIRECT_URL, "--include-seed", "--yes"]);

  console.log("4/4 Backfill seed-dependent rows when needed");
  await backfillSeedDependentRows(env);

  console.log("Database setup complete.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
