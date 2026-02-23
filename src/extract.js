import pg from 'pg';
import dns from 'dns';
const { Client } = pg;

/**
 * Connect to a Postgres database and extract the full public schema metadata.
 * Returns a structured object with tables, columns, indexes, foreign keys,
 * enums, RLS policies, functions, and triggers.
 */
export async function extractSchema(connectionString, label = 'database') {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    // Force IPv4 — Render uses IPv6 by default which Supabase doesn't support
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, family: 4 }, callback);
    },
  });

  try {
    await client.connect();
    console.log(`  ✓ Connected to ${label}`);

    const [tables, columns, indexes, foreignKeys, enums, policies, functions, triggers] =
      await Promise.all([
        queryTables(client),
        queryColumns(client),
        queryIndexes(client),
        queryForeignKeys(client),
        queryEnums(client),
        queryPolicies(client),
        queryFunctions(client),
        queryTriggers(client),
      ]);

    console.log(`  ✓ Extracted schema from ${label} (${tables.length} tables, ${columns.length} columns)`);

    return { tables, columns, indexes, foreignKeys, enums, policies, functions, triggers };
  } finally {
    await client.end();
  }
}

async function queryTables(client) {
  const { rows } = await client.query(`
    SELECT table_name, table_type,
           obj_description((quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass, 'pg_class') AS comment
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  return rows;
}

async function queryColumns(client) {
  const { rows } = await client.query(`
    SELECT table_name, column_name, ordinal_position,
           data_type, udt_name, character_maximum_length,
           numeric_precision, numeric_scale,
           is_nullable, column_default, is_identity,
           identity_generation, is_generated, generation_expression
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  return rows;
}

async function queryIndexes(client) {
  const { rows } = await client.query(`
    SELECT schemaname, tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);
  return rows;
}

async function queryForeignKeys(client) {
  const { rows } = await client.query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name
  `);
  return rows;
}

async function queryEnums(client) {
  const { rows } = await client.query(`
    SELECT t.typname AS enum_name,
           e.enumlabel AS enum_value,
           e.enumsortorder
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `);
  return rows;
}

async function queryPolicies(client) {
  const { rows } = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `);
  return rows;
}

async function queryFunctions(client) {
  const { rows } = await client.query(`
    SELECT p.proname AS function_name,
           pg_get_function_arguments(p.oid) AS arguments,
           pg_get_function_result(p.oid) AS return_type,
           CASE p.prokind
             WHEN 'f' THEN 'function'
             WHEN 'p' THEN 'procedure'
             WHEN 'a' THEN 'aggregate'
             WHEN 'w' THEN 'window'
           END AS kind,
           p.prosecdef AS security_definer,
           l.lanname AS language
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_language l ON p.prolang = l.oid
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  `);
  return rows;
}

async function queryTriggers(client) {
  const { rows } = await client.query(`
    SELECT trigger_name, event_manipulation, event_object_table,
           action_statement, action_timing, action_orientation
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name
  `);
  return rows;
}
