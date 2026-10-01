// Synthetic encrypted recovery proof. No production credential, task or network target.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { taskDetailsRelease as release, verifyTaskDetailsReleaseContract } from "./task-details-release-contract.mjs";
import { assertEffectiveFunctionPolicy, effectiveFunctionQuery } from "./function-privilege-policy.mjs";

const migrations = verifyTaskDetailsReleaseContract();
const root = mkdtempSync(path.join(tmpdir(), "project-local-task-details-recovery-"));
const packagePath = path.join(root, "package");
mkdirSync(packagePath);
const image = "public.ecr.aws/supabase/postgres:17.6.1.171";
const prefix = `project-local-task-details-recovery-${process.pid}-${Date.now()}`;
const source = `${prefix}-source`, target = `${prefix}-target`;
const created = [];
const secret = "SyntheticLocalRecoveryOnly123";
function command(file, args, input, env = {}) {
  const result = spawnSync(file, args, { input, env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  // Never print SQL, credentials, document bodies or recovered rows on failure.
  assert.equal(result.status, 0, `${file}: local recovery step failed (exit ${result.status})`);
  return result.stdout;
}
function sql(container, query) {
  assert(created.includes(container), "Only this runner's disposable containers may be queried");
  return command("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], query).toString().trim();
}
async function start(container, loopback = false) {
  command("docker", ["run", "--detach", "--name", container, ...(loopback ? ["--publish", "127.0.0.1::5432"] : ["--network", "none"]), "--env", `POSTGRES_PASSWORD=${secret}`, image]);
  created.push(container);
  let ready = 0;
  for (let n = 0; n < 60 && ready < 3; n++) {
    ready = spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres", "-d", "postgres"], { windowsHide: true }).status === 0 ? ready + 1 : 0;
    await delay(750);
  }
  assert.equal(ready, 3, "Disposable pinned PostgreSQL did not become ready");
}
const workspace = randomUUID(), preset = randomUUID(), item = randomUUID();
const admin = randomUUID(), adminContact = randomUUID(), viewer = randomUUID(), viewerContact = randomUUID();
const privateText = "Synthetic private arrival instructions.\n\nBring the assigned equipment.";
function fingerprint(container) {
  const tables = sql(container, "select tablename from pg_tables where schemaname='public' order by tablename").split(/\r?\n/);
  assert.equal(tables.length, release.publicTables);
  return Object.fromEntries(tables.map(name => {
    assert.match(name, /^[a-z_]+$/);
    return [name, sql(container, `select count(*) || '|' || md5(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),'')) from public.${name} t`)];
  }));
}
function verify(container) {
  assert.equal(sql(container, "select string_agg(version,',' order by version) from supabase_migrations.schema_migrations"), migrations.map(m => m.slice(0, 14)).join(","));
  const functions = sql(container, effectiveFunctionQuery).split(/\r?\n/).map(JSON.parse);
  assert.equal(functions.length, release.publicFunctions);
  const legacyLookup = "verify_volunteer_schedule_lookup(text,text,text)";
  const legacy = functions.find(row => row.signature === legacyLookup);
  assert(legacy, "Historical lookup function is missing");
  assert.equal(legacy.owner, "postgres");
  assert.equal(legacy.public, false);
  assert.equal(legacy.anon, true);
  assert.equal(legacy.authenticated, true);
  assert.equal(legacy.service_role, true);
  assert.deepEqual(legacy.config, ['search_path=""']);
  assertEffectiveFunctionPolicy(assert, functions.filter(row => row.signature !== legacyLookup), { historicalExclusions: [
    "resolve_volunteer_schedule_contact(text,text)",
    "create_current_workspace_repeated_calendar_items(uuid,uuid,text,text,date,date,integer,smallint[],time without time zone,time without time zone,integer,text,jsonb,text,text,text,text,integer)",
    "update_calendar_item_one_off_timed(uuid,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone)",
    "update_calendar_item_preset_timed(uuid,date,date,time without time zone,time without time zone,integer,text,jsonb,timestamp with time zone)",
    "publish_draft_on_assignment()",
    "calendar_local_time_is_unique(date,time without time zone,text)",
    "validate_calendar_timed_interval()",
    legacyLookup,
  ] });
  assert.equal(sql(container, "select count(*) from pg_tables where schemaname='public' and not rowsecurity"), "0");
  assert.equal(sql(container, "select count(*) from pg_policy where polrelid='public.assignment_instruction_revisions'::regclass"), "0");
  assert.equal(sql(container, "select count(*) from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a where d.defaclrole='postgres'::regrole and d.defaclnamespace in (0,'public'::regnamespace) and d.defaclobjtype in ('r','f') and a.grantee in (0,'anon'::regrole,'authenticated'::regrole)"), "0");
  for (const role of ["anon", "authenticated"]) {
    assert.equal(sql(container, `select has_table_privilege('${role}','public.assignment_instruction_revisions','SELECT') or has_sequence_privilege('${role}','public.assignment_instruction_revisions_id_seq','USAGE,SELECT,UPDATE')`), "f");
  }
  const actorQuery = (actor, expression) => sql(container, `begin; set local role authenticated; set local request.jwt.claim.sub='${actor}'; set local request.jwt.claims='{"sub":"${actor}","role":"authenticated"}'; ${expression}; rollback;`);
  assert.equal(actorQuery(admin, `select schedule_notes from public.read_authorized_calendar_items('${workspace}',null,null)`), privateText);
  assert.equal(actorQuery(viewer, `select count(*) from public.read_authorized_calendar_items('${workspace}',null,null) where schedule_notes is null and custom_values='{}'::jsonb`), "1");
  assert.equal(actorQuery(viewer, `select count(*) from public.calendar_items where workspace_id='${workspace}'`), "0");
  assert.equal(actorQuery(viewer, `select count(*) from public.read_authorized_task_presets('${workspace}') where description is null and custom_field_definitions='[]'::jsonb`), "1");
  const bearer = sql(container, "select pg_get_functiondef('public.read_project_quick_view_by_token(text,date)'::regprocedure)");
  assert.match(bearer, /'schedule_notes',null/);
  assert.match(bearer, /'task_description',null/);
  assert.match(bearer, /'custom_values','\{\}'::jsonb/);
  assert.match(sql(container, "select pg_get_expr(polqual,polrelid) from pg_policy where polrelid='public.calendar_items'::regclass and polname='calendar_items_select_with_view_capability'"), /calendar.edit/);
  assert.match(sql(container, "select pg_get_expr(polqual,polrelid) from pg_policy where polrelid='public.task_presets'::regclass and polname='task_presets_select_with_view_capability'"), /tasks.edit/);
}
try {
  await start(source, true);
  console.log("Local recovery: pinned disposable source ready");
  sql(source, "create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key, statements text[], name text)");
  for (const file of migrations.filter(m => m.slice(0, 14) <= release.before)) {
    sql(source, readFileSync(path.join("supabase/migrations", file), "utf8"));
    sql(source, `insert into supabase_migrations.schema_migrations(version,name) values ('${file.slice(0, 14)}','${file.slice(15, -4)}')`);
  }
  sql(source, `insert into auth.users(id) values ('${admin}'),('${viewer}');
    insert into public.project_contacts(id,auth_user_id) values ('${adminContact}','${admin}'),('${viewerContact}','${viewer}');
    insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone) values ('${workspace}','synthetic-recovery','Synthetic Recovery Project','active','America/Denver');
    insert into public.workspace_contact_grants(workspace_id,project_contact_id,role,capabilities) values
      ('${workspace}','${adminContact}','main_contact',array['workspace.read','calendar.view','calendar.edit','tasks.view','tasks.edit']),
      ('${workspace}','${viewerContact}','on_site_contact',array['workspace.read','calendar.view','tasks.view']);
    insert into public.task_presets(id,workspace_id,name,description,task_type) values ('${preset}','${workspace}','Synthetic Task','Historical preset instructions','general');
    insert into public.calendar_items(id,workspace_id,task_preset_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,schedule_notes,publication_state,published_at,published_by_project_contact_id)
    values ('${item}','${workspace}','${preset}','Synthetic Task','general','timed','2026-10-10','08:00','10:00','America/Denver',1,'Historical occurrence instructions','published',now(),'${adminContact}')`);
  for (const migration of release.migrations) {
    sql(source, readFileSync(path.join("supabase/migrations", migration.file), "utf8"));
    sql(source, `insert into supabase_migrations.schema_migrations(version,name) values ('${migration.file.slice(0, 14)}','${migration.file.slice(15, -4)}')`);
  }
  assert.equal(sql(source, `select schedule_notes from public.calendar_items where id='${item}'`), "Historical occurrence instructions");
  sql(source, `update public.calendar_items set schedule_notes='${privateText}' where id='${item}'`);
  assert.equal(sql(source, "select count(*) from public.assignment_instruction_revisions"), "1");
  verify(source);
  const before = fingerprint(source);
  // The existing native writer uses Windows CRLF; normalize only line endings,
  // never SQL tokens or permissions, when comparing recovered definitions.
  const bodyDigestQuery = "select md5(string_agg(replace(pg_get_functiondef(p.oid),chr(13),''),'|' order by p.oid::regprocedure::text)) from pg_proc p where p.pronamespace='public'::regnamespace";
  const bodyDigest = sql(source, bodyDigestQuery);
  const aclQuery = `select md5(string_agg(entry,'|' order by entry)) from (
    select c.relname || '|' || c.relkind::text || '|' || pg_get_userbyid(c.relowner) || '|' || pg_get_userbyid(a.grantor) || '|' || case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end || '|' || a.privilege_type || '|' || a.is_grantable entry
    from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) a
    where c.relnamespace='public'::regnamespace and c.relkind in ('r','p','S')
    union all select p.oid::regprocedure::text || '|' || pg_get_userbyid(p.proowner) || '|' || pg_get_userbyid(a.grantor) || '|' || case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end || '|' || a.privilege_type || '|' || a.is_grantable
    from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.pronamespace='public'::regnamespace
    union all select 'default|' || pg_get_userbyid(d.defaclrole) || '|' || case when d.defaclnamespace=0 then 'global' else 'public' end || '|' || d.defaclobjtype::text || '|' || pg_get_userbyid(a.grantor) || '|' || case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end || '|' || a.privilege_type || '|' || a.is_grantable
    from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a where d.defaclrole='postgres'::regrole and d.defaclnamespace in (0,'public'::regnamespace)
  ) source_acl`;
  const aclDigest = sql(source, aclQuery);
  const port = command("docker", ["port", source, "5432/tcp"]).toString().match(/127\.0\.0\.1:(\d+)/)?.[1];
  assert(port, "Synthetic source must expose loopback only");
  const fixtureOutput = command("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/production-backup/Invoke-ProjectLocalProductionBackup.ps1", "-FixtureMode", "-FixtureScenario", "TaskDetailsRecoveryPackage", "-FixturePackageOutputDirectory", packagePath], undefined,
    { PROJECT_LOCAL_NATIVE_DUMP_FIXTURE_URL: `postgresql://postgres:${secret}@127.0.0.1:${port}/postgres`, SUPABASE_SERVICE_ROLE_KEY: "" }).toString();
  assert.match(fixtureOutput, /fixture_task_details_recovery_package_ok/);
  const manifest = JSON.parse(readFileSync(path.join(packagePath, "manifest.json"), "utf8"));
  assert.equal(manifest.expectedMigration, release.final);
  assert.equal(manifest.expectedProjectRef, "loopback-only");
  const members = ["roles.sql", "schema.sql", "data.sql", "supabase_migrations_schema.sql", "supabase_migrations_data.sql", "manifest.json"];
  for (const member of members.slice(0, -1)) assert.equal(readFileSync(path.join(packagePath, member)).length, manifest.dumpFileSizes[member]);
  const identity = path.join(root, "fixture-age-identity.txt");
  command("age-keygen", ["-o", identity]);
  const recipient = command("age-keygen", ["-y", identity]).toString().trim();
  const zipPath = path.join(root, "fixture.zip"), encryptedPath = `${zipPath}.age`;
  command("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -LiteralPath @(${members.map(m => `'${path.join(packagePath, m).replaceAll("'", "''")}'`).join(",")}) -DestinationPath '${zipPath.replaceAll("'", "''")}'`]);
  command("age", ["-r", recipient, "-o", encryptedPath, zipPath]);
  const encrypted = readFileSync(encryptedPath);
  const checksum = createHash("sha256").update(encrypted).digest("hex");
  const independent = command("powershell.exe", ["-NoProfile", "-Command", `[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([IO.File]::ReadAllBytes('${encryptedPath.replaceAll("'", "''")}'))).Replace('-','')`]).toString().trim().toLowerCase();
  assert.equal(checksum, independent);
  const decrypted = command("age", ["-d", "-i", identity, encryptedPath]);
  assert.deepEqual(decrypted, readFileSync(zipPath));
  const recoveredZip = path.join(root, "recovered.zip"), recoveredPath = path.join(root, "recovered");
  writeFileSync(recoveredZip, decrypted);
  command("powershell.exe", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${recoveredZip.replaceAll("'", "''")}' -DestinationPath '${recoveredPath.replaceAll("'", "''")}'`]);
  for (const member of members) assert.deepEqual(readFileSync(path.join(recoveredPath, member)), readFileSync(path.join(packagePath, member)));
  await start(target);
  assert.equal(command("docker", ["inspect", target, "--format", "{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}"]).toString().trim(), "none|{}");
  // Pinned platform supplies managed roles/Auth/Storage definitions; never replay
  // globals over platform roles. The package's real app schema restores its ACLs.
  sql(target, readFileSync("scripts/production-backup/task-details-restore-platform-defaults.sql", "utf8"));
  for (const member of ["schema.sql", "supabase_migrations_schema.sql", "supabase_migrations_data.sql", "data.sql"]) {
    sql(target, readFileSync(path.join(recoveredPath, member), "utf8"));
  }
  verify(target);
  assert.equal(sql(target, bodyDigestQuery), bodyDigest, "All function bodies, including volunteer/notification RPCs, must survive recovery");
  assert.equal(sql(target, aclQuery), aclDigest, "Exact table, sequence, function and creator-default ACLs must match the source");
  assert.deepEqual(fingerprint(target), before, "Every public table fingerprint must survive recovery");
  assert.equal(sql(target, `select schedule_notes from public.calendar_items where id='${item}'`), privateText);
  assert.equal(sql(target, "select previous_text from public.assignment_instruction_revisions"), "Historical occurrence instructions");
  assert.equal(sql(target, "select nextval('public.assignment_instruction_revisions_id_seq')"), "2");
  assert.equal(sql(target, "select count(*) from public.assignment_notification_deliveries"), "0");
  console.log(`PASS encrypted synthetic recovery: 45 ordered migrations, ${release.publicTables} table fingerprints, ${release.publicFunctions} exact function ACLs, private revision history/sequence, privacy RLS/projection, independent SHA-256 and matching six-file manifest. No email.`);
} finally {
  for (const container of created.reverse()) command("docker", ["rm", "--force", "--volumes", container]);
  assert(root.startsWith(path.join(tmpdir(), "project-local-task-details-recovery-")));
  rmSync(root, { recursive: true, force: true });
  assert.equal(existsSync(root), false);
  console.log("Local recovery cleanup: owned containers, synthetic key and plaintext/encrypted temporary files removed");
}
