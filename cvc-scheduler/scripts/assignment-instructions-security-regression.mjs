// Catalog and direct-access proof against the disposable local database only.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { assertEffectiveFunctionPolicy, effectiveFunctionQuery } from "./function-privilege-policy.mjs";

const container = "supabase_db_cvc-scheduler";
function sql(query, success = true) {
  const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], {
    input: query, encoding: "utf8", windowsHide: true,
  });
  if (success) assert.equal(result.status, 0, result.stderr);
  return result;
}
const value = query => sql(query).stdout.trim();
assertEffectiveFunctionPolicy(assert, value(effectiveFunctionQuery).split(/\r?\n/).map(JSON.parse));
assert.equal(value("select max(version) from supabase_migrations.schema_migrations"), "20260926120000");
assert.equal(value("select relrowsecurity from pg_class where oid='public.assignment_instruction_revisions'::regclass"), "t");
assert.equal(value("select count(*) from pg_policy where polrelid='public.assignment_instruction_revisions'::regclass"), "0");
assert.equal(value(`select count(*) from pg_class c cross join lateral aclexplode(c.relacl) a
  where c.oid in ('public.assignment_instruction_revisions'::regclass,'public.assignment_instruction_revisions_id_seq'::regclass)
    and a.grantee in (0,'anon'::regrole,'authenticated'::regrole)`), "0");
assert.equal(value(`select count(*) from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
  where d.defaclrole='postgres'::regrole and d.defaclobjtype in ('r','f')
    and d.defaclnamespace in (0,'public'::regnamespace)
    and a.grantee in (0,'anon'::regrole,'authenticated'::regrole)`), "0");
// Sequence defaults are separate platform defaults. The protected sequence must
// deny access explicitly even when ordinary roles have future-sequence defaults.
for (const role of ["anon", "authenticated"]) {
  for (const query of [
    "select * from public.assignment_instruction_revisions",
    "select nextval('public.assignment_instruction_revisions_id_seq')",
    "select public.audit_assignment_instruction_update()",
    "select public.prepare_assignment_instruction_insert()",
    "select public.track_assignment_instruction_update()",
  ]) {
    const denied = sql(`begin; set local role ${role}; ${query}; rollback;`, false);
    assert.notEqual(denied.status, 0, `${role}: private instruction access was allowed.`);
    assert.match(denied.stderr, /permission denied/);
  }
}
for (const role of ["anon", "authenticated"]) {
  assert.equal(value(`select has_table_privilege('${role}','public.calendar_items','INSERT,UPDATE,DELETE')
    or has_table_privilege('${role}','public.task_presets','INSERT,UPDATE,DELETE')`), "f");
}
const migration = readFileSync(new URL("../supabase/migrations/20260926120000_assignment_instructions.sql", import.meta.url), "utf8");
assert(!/grant\s+execute[\s\S]*?to\s+anon/i.test(migration));
assert(!/create\s+policy|alter\s+policy|read_volunteer_schedule|read_project_quick_view_by_token/i.test(migration));
assert.match(migration, /calendar_item_instruction_version_check/);
assert.match(migration, /using errcode = '40001', detail = 'calendar_item_edit_conflict'/);
assert.match(migration, /using errcode = '40001', detail = 'task_preset_edit_conflict'/);
console.log("Instruction security passed: exact 77-function policy, private RLS history and sequence, denied direct reads/writes, hardened table/function defaults, no new anonymous or bearer RPC.");
