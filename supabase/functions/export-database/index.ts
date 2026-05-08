// Admin-only database export. Streams a schema + data SQL dump from the live
// Postgres instance (via SUPABASE_DB_URL) to private Storage and returns
// short-lived signed download URLs. The DB connection string never appears
// in responses or logs.
import postgres from "npm:postgres@3.4.4";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXCLUDED_SCHEMAS = [
  "auth",
  "storage",
  "realtime",
  "supabase_functions",
  "vault",
  "graphql",
  "graphql_public",
  "net",
  "cron",
  "pgsodium",
  "pgsodium_masks",
  "extensions",
  "pg_catalog",
  "information_schema",
  "pg_toast",
];

const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Quote a Postgres identifier safely
function qi(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

// Format a JS value as a Postgres SQL literal
function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "'NaN'";
    return String(v);
  }
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (v instanceof Uint8Array) {
    // bytea hex format
    let hex = "";
    for (const b of v) hex += b.toString(16).padStart(2, "0");
    return `'\\x${hex}'`;
  }
  if (Array.isArray(v)) {
    // Postgres array literal — quote each element
    const inner = v
      .map((item) => {
        if (item === null || item === undefined) return "NULL";
        if (typeof item === "number" || typeof item === "boolean") {
          return String(item);
        }
        const s = typeof item === "string" ? item : JSON.stringify(item);
        return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      })
      .join(",");
    return `'{${inner}}'`;
  }
  if (typeof v === "object") {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function dumpSchema(sql: ReturnType<typeof postgres>): Promise<string> {
  const out: string[] = [];
  out.push("-- Schema dump (public schema only)");
  out.push(
    `-- Excludes Supabase-internal schemas: ${EXCLUDED_SCHEMAS.join(", ")}`,
  );
  out.push("-- Generated: " + new Date().toISOString());
  out.push("");
  out.push("SET statement_timeout = 0;");
  out.push("SET client_encoding = 'UTF8';");
  out.push("SET standard_conforming_strings = on;");
  out.push("SET check_function_bodies = false;");
  out.push("SET client_min_messages = warning;");
  out.push("SET search_path = public, pg_catalog;");
  out.push("");

  // Enums
  const enums = await sql`
    SELECT n.nspname AS schema, t.typname AS name,
      array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY n.nspname, t.typname
    ORDER BY t.typname
  `;
  for (const e of enums as any[]) {
    const labels = e.labels
      .map((l: string) => `'${l.replace(/'/g, "''")}'`)
      .join(", ");
    out.push(`CREATE TYPE ${qi(e.schema)}.${qi(e.name)} AS ENUM (${labels});`);
  }
  if (enums.length) out.push("");

  // Sequences
  const sequences = await sql`
    SELECT sequence_schema, sequence_name, data_type,
      start_value, minimum_value, maximum_value, increment, cycle_option
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `;
  for (const s of sequences as any[]) {
    out.push(
      `CREATE SEQUENCE IF NOT EXISTS ${qi(s.sequence_schema)}.${qi(s.sequence_name)} ` +
        `AS ${s.data_type} ` +
        `START WITH ${s.start_value} INCREMENT BY ${s.increment} ` +
        `MINVALUE ${s.minimum_value} MAXVALUE ${s.maximum_value} ` +
        `${s.cycle_option === "YES" ? "CYCLE" : "NO CYCLE"};`,
    );
  }
  if (sequences.length) out.push("");

  // Tables (columns only — constraints added later)
  const tables = await sql`
    SELECT n.nspname AS schema, c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public'
    ORDER BY c.relname
  `;

  for (const t of tables as any[]) {
    const cols = await sql`
      SELECT column_name, data_type, udt_schema, udt_name,
        is_nullable, column_default, character_maximum_length,
        numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = ${t.schema} AND table_name = ${t.name}
      ORDER BY ordinal_position
    `;
    const colDefs = (cols as any[]).map((c) => {
      let type: string;
      if (c.data_type === "ARRAY") {
        const base = c.udt_name.replace(/^_/, "");
        type = `${base}[]`;
      } else if (c.data_type === "USER-DEFINED") {
        type = `${qi(c.udt_schema)}.${qi(c.udt_name)}`;
      } else if (
        c.character_maximum_length &&
        ["character varying", "character", "varchar", "char"].includes(
          c.data_type,
        )
      ) {
        type = `${c.data_type}(${c.character_maximum_length})`;
      } else if (
        c.data_type === "numeric" &&
        c.numeric_precision != null
      ) {
        type =
          c.numeric_scale != null
            ? `numeric(${c.numeric_precision},${c.numeric_scale})`
            : `numeric(${c.numeric_precision})`;
      } else {
        type = c.data_type;
      }
      let line = `  ${qi(c.column_name)} ${type}`;
      if (c.column_default) line += ` DEFAULT ${c.column_default}`;
      if (c.is_nullable === "NO") line += ` NOT NULL`;
      return line;
    });
    out.push(
      `CREATE TABLE ${qi(t.schema)}.${qi(t.name)} (\n${colDefs.join(",\n")}\n);`,
    );
    out.push("");
  }

  // Constraints — primary key first, then unique, check, foreign key
  const constraints = await sql`
    SELECT n.nspname AS schema, cl.relname AS table_name,
      c.conname, pg_get_constraintdef(c.oid) AS def, c.contype
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY
      CASE c.contype WHEN 'p' THEN 1 WHEN 'u' THEN 2 WHEN 'c' THEN 3 WHEN 'f' THEN 4 ELSE 5 END,
      cl.relname, c.conname
  `;
  for (const c of constraints as any[]) {
    out.push(
      `ALTER TABLE ${qi(c.schema)}.${qi(c.table_name)} ADD CONSTRAINT ${qi(c.conname)} ${c.def};`,
    );
  }
  if (constraints.length) out.push("");

  // Indexes (skip those backing PK/UNIQUE constraints — already created)
  const indexes = await sql`
    SELECT i.schemaname, i.tablename, i.indexname, i.indexdef
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conname = i.indexname AND c.contype IN ('p','u')
      )
    ORDER BY i.tablename, i.indexname
  `;
  for (const i of indexes as any[]) {
    out.push(`${i.indexdef};`);
  }
  if (indexes.length) out.push("");

  // Functions (public schema only)
  const functions = await sql`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
    ORDER BY p.proname
  `;
  for (const f of functions as any[]) {
    out.push(`${f.def};`);
    out.push("");
  }

  // Views
  const views = await sql`
    SELECT n.nspname AS schema, c.relname AS name,
      pg_get_viewdef(c.oid, true) AS def
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v' AND n.nspname = 'public'
    ORDER BY c.relname
  `;
  for (const v of views as any[]) {
    out.push(
      `CREATE OR REPLACE VIEW ${qi(v.schema)}.${qi(v.name)} AS\n${v.def};`,
    );
    out.push("");
  }

  // Triggers
  const triggers = await sql`
    SELECT pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  `;
  for (const tr of triggers as any[]) {
    out.push(`${tr.def};`);
  }
  if (triggers.length) out.push("");

  // Enable RLS where it's enabled in the source
  const rlsTables = await sql`
    SELECT n.nspname AS schema, c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relrowsecurity = true
    ORDER BY c.relname
  `;
  for (const t of rlsTables as any[]) {
    out.push(
      `ALTER TABLE ${qi(t.schema)}.${qi(t.name)} ENABLE ROW LEVEL SECURITY;`,
    );
  }
  if (rlsTables.length) out.push("");

  // Policies
  const policies = await sql`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `;
  for (const p of policies as any[]) {
    let stmt = `CREATE POLICY ${qi(p.policyname)} ON ${qi(p.schemaname)}.${qi(p.tablename)}`;
    if (p.permissive === "PERMISSIVE") stmt += ` AS PERMISSIVE`;
    else if (p.permissive === "RESTRICTIVE") stmt += ` AS RESTRICTIVE`;
    stmt += ` FOR ${p.cmd}`;
    if (
      p.roles &&
      p.roles.length &&
      !(p.roles.length === 1 && p.roles[0] === "public")
    ) {
      const roles = p.roles
        .map((r: string) => (r === "public" ? "public" : qi(r)))
        .join(", ");
      stmt += ` TO ${roles}`;
    }
    if (p.qual) stmt += ` USING (${p.qual})`;
    if (p.with_check) stmt += ` WITH CHECK (${p.with_check})`;
    out.push(`${stmt};`);
  }
  if (policies.length) out.push("");

  return out.join("\n");
}

async function dumpData(sql: ReturnType<typeof postgres>): Promise<string> {
  const out: string[] = [];
  out.push("-- Data dump");
  out.push(
    "-- Triggers disabled during import via session_replication_role = replica",
  );
  out.push("-- Generated: " + new Date().toISOString());
  out.push("");
  out.push("BEGIN;");
  out.push("SET session_replication_role = replica;");
  out.push("");

  const targets: { schema: string; name: string }[] = [];

  const publicTables = await sql`
    SELECT n.nspname AS schema, c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public'
    ORDER BY c.relname
  `;
  for (const t of publicTables as any[]) {
    targets.push({ schema: t.schema, name: t.name });
  }
  // Auth + storage tables that must round-trip
  targets.push({ schema: "auth", name: "users" });
  targets.push({ schema: "auth", name: "identities" });
  targets.push({ schema: "storage", name: "objects" });

  for (const t of targets) {
    const cols = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = ${t.schema} AND table_name = ${t.name}
      ORDER BY ordinal_position
    `;
    if (!cols.length) {
      out.push(`-- ${t.schema}.${t.name}: table not found, skipped`);
      out.push("");
      continue;
    }
    const colNames = (cols as any[]).map((c) => c.column_name);
    const colList = colNames.map(qi).join(", ");

    const rows = await sql.unsafe(
      `SELECT ${colList} FROM ${qi(t.schema)}.${qi(t.name)}`,
    );

    out.push(`-- ${t.schema}.${t.name} (${rows.length} rows)`);
    if (!rows.length) {
      out.push("");
      continue;
    }

    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const tuples = batch
        .map(
          (row: any) =>
            `  (${colNames.map((c) => formatValue(row[c])).join(", ")})`,
        )
        .join(",\n");
      out.push(
        `INSERT INTO ${qi(t.schema)}.${qi(t.name)} (${colList}) VALUES`,
      );
      out.push(`${tuples};`);
    }
    out.push("");
  }

  // Restore sequence positions for public schema
  const sequences = await sql`
    SELECT sequence_schema, sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  `;
  for (const s of sequences as any[]) {
    out.push(
      `SELECT setval('${s.sequence_schema}.${s.sequence_name}'::regclass, ` +
        `(SELECT COALESCE(last_value, 1) FROM ${qi(s.sequence_schema)}.${qi(s.sequence_name)}));`,
    );
  }
  if (sequences.length) out.push("");

  out.push("SET session_replication_role = DEFAULT;");
  out.push("COMMIT;");
  return out.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!dbUrl || !supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: "Server not configured" }, 500);
  }

  // Helper to scrub the DB URL (and password) from any string
  const scrub = (s: string) => {
    let r = s.split(dbUrl).join("[REDACTED_DB_URL]");
    // Also scrub bare password if it ever appears alone
    try {
      const u = new URL(dbUrl);
      if (u.password) r = r.split(u.password).join("[REDACTED]");
    } catch (_) {
      // ignore
    }
    return r;
  };

  // ── AuthN/AuthZ: must be an admin or super_admin ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: roles, error: rolesErr } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (rolesErr) {
    return json({ error: "Role check failed" }, 500);
  }
  const isAdmin = (roles ?? []).some(
    (r: any) => r.role === "admin" || r.role === "super_admin",
  );
  if (!isAdmin) return json({ error: "Admin access required" }, 403);

  // ── Connect to Postgres ──
  // prepare:false avoids prepared-statement issues across the pooler.
  const sql = postgres(dbUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false,
  });

  try {
    const startedAt = Date.now();
    const schemaSql = await dumpSchema(sql);
    const dataSql = await dumpData(sql);

    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    const base = `${user.id}/${ts}`;
    const schemaPath = `${base}/schema.sql`;
    const dataPath = `${base}/data.sql`;

    const schemaUpload = await adminClient.storage
      .from("db-exports")
      .upload(schemaPath, new Blob([schemaSql], { type: "text/plain" }), {
        contentType: "text/plain",
        upsert: false,
      });
    if (schemaUpload.error) {
      return json(
        { error: "Schema upload failed", detail: scrub(schemaUpload.error.message) },
        500,
      );
    }

    const dataUpload = await adminClient.storage
      .from("db-exports")
      .upload(dataPath, new Blob([dataSql], { type: "text/plain" }), {
        contentType: "text/plain",
        upsert: false,
      });
    if (dataUpload.error) {
      return json(
        { error: "Data upload failed", detail: scrub(dataUpload.error.message) },
        500,
      );
    }

    const [{ data: schemaSigned }, { data: dataSigned }] = await Promise.all([
      adminClient.storage
        .from("db-exports")
        .createSignedUrl(schemaPath, SIGNED_URL_TTL_SECONDS),
      adminClient.storage
        .from("db-exports")
        .createSignedUrl(dataPath, SIGNED_URL_TTL_SECONDS),
    ]);

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `export-database: ok user=${user.id} schema=${schemaSql.length}b data=${dataSql.length}b elapsed=${elapsedMs}ms`,
    );

    return json({
      success: true,
      schema: {
        path: schemaPath,
        size_bytes: schemaSql.length,
        signed_url: schemaSigned?.signedUrl ?? null,
      },
      data: {
        path: dataPath,
        size_bytes: dataSql.length,
        signed_url: dataSigned?.signedUrl ?? null,
      },
      expires_in_seconds: SIGNED_URL_TTL_SECONDS,
      generated_at: new Date().toISOString(),
      elapsed_ms: elapsedMs,
    });
  } catch (e) {
    const msg = scrub(e instanceof Error ? e.message : String(e));
    console.error("export-database failed:", msg);
    return json({ error: "Export failed", detail: msg }, 500);
  } finally {
    try {
      await sql.end({ timeout: 5 });
    } catch (_) {
      // ignore
    }
  }
});
