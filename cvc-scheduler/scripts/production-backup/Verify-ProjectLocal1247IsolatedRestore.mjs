import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { anonymousFunctions, authenticatedFunctions, internalFunctions, assertEffectiveFunctionPolicy, effectiveFunctionQuery } from '../function-privilege-policy.mjs';

const container = process.argv[2];
assert.match(container ?? '', /^pl-1247-(?:restore|platform)-(primary|secondary)$/);
const inspect = spawnSync('docker', ['inspect', container, '--format', '{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}'], { encoding: 'utf8' });
assert.equal(inspect.status, 0);
assert.equal(inspect.stdout.trim(), 'none|{}', 'Restore container must have no network or published ports');
function query(sql) {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { input: sql, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
const rows = query(effectiveFunctionQuery).split(/\r?\n/).map(JSON.parse);
assertEffectiveFunctionPolicy(assert, rows);
assert.equal(query("select max(version) from supabase_migrations.schema_migrations"), '20260922150000');
assert.equal(query("select count(*) from supabase_migrations.schema_migrations"), '43');
assert.equal(query("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity"), '0');
assert.equal(query("select count(*) from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a where d.defaclrole='postgres'::regrole and d.defaclnamespace in (0, 'public'::regnamespace) and d.defaclobjtype='f' and a.privilege_type='EXECUTE' and a.grantee in (0,'anon'::regrole,'authenticated'::regrole)"), '0');
const counts = query("select count(*) || '|' || count(*) filter (where relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')");
console.log(`PASS exact ACL ${rows.length} (${anonymousFunctions.length}/${authenticatedFunctions.length}/${internalFunctions.length}), PUBLIC/default 0, all public tables RLS, forced RLS ${counts.split('|')[1]}/${counts.split('|')[0]}, terminal 20260922150000`);
