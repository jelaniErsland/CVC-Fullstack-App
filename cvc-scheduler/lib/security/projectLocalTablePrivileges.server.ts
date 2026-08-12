import "server-only";

import { readFileSync } from "node:fs";

type ProtectedGrantee = "anon" | "authenticated" | "PUBLIC";

export type ProjectLocalTablePrivilegeRow = {
  table_name: string;
  grantee: string;
  privilege_type: string;
};

export type ProjectLocalDefaultTablePrivilegeRow = {
  owner_name: string;
  schema_name: string;
  grantee: string;
  privilege_type: string;
};

type PrivilegeContract = {
  version: string;
  schema: string;
  creatorRole: string;
  protectedGrantees: ProtectedGrantee[];
  directPrivileges: Record<string, Record<ProtectedGrantee, string[]>>;
  defaultTablePrivileges: Record<ProtectedGrantee, string[]>;
};

function readContract(): PrivilegeContract {
  const source = readFileSync(
    new URL("./projectLocalTablePrivileges.contract.json", import.meta.url),
    "utf8",
  );
  const parsed = JSON.parse(source) as PrivilegeContract;
  const expectedGrantees = ["PUBLIC", "anon", "authenticated"];
  const actualGrantees = [...parsed.protectedGrantees].sort();

  if (
    parsed.version !== "20260812123430" ||
    parsed.schema !== "public" ||
    parsed.creatorRole !== "postgres" ||
    JSON.stringify(actualGrantees) !== JSON.stringify(expectedGrantees)
  ) {
    throw new Error("Project Local table privilege contract metadata is invalid.");
  }

  const tableNames = Object.keys(parsed.directPrivileges);
  if (tableNames.length !== 13 || new Set(tableNames).size !== tableNames.length) {
    throw new Error("Project Local table privilege contract must describe exactly 13 unique tables.");
  }

  for (const [tableName, grants] of Object.entries(parsed.directPrivileges)) {
    if (!/^[a-z][a-z0-9_]*$/.test(tableName)) {
      throw new Error("Project Local table privilege contract contains an unsafe table identifier.");
    }
    for (const grantee of parsed.protectedGrantees) {
      if (!Array.isArray(grants[grantee])) {
        throw new Error(`Project Local privilege contract is missing ${grantee} for ${tableName}.`);
      }
    }
  }

  return parsed;
}

export const projectLocalTablePrivilegeContract = readContract();

export const projectLocalTableNames = Object.freeze(
  Object.keys(projectLocalTablePrivilegeContract.directPrivileges),
);

export const projectLocalProtectedGrantees = Object.freeze(
  [...projectLocalTablePrivilegeContract.protectedGrantees],
);

function normalizeGrantee(grantee: string): string {
  return grantee.toUpperCase() === "PUBLIC" ? "PUBLIC" : grantee.toLowerCase();
}

function directPrivilegeKey(row: ProjectLocalTablePrivilegeRow): string {
  return [row.table_name, normalizeGrantee(row.grantee), row.privilege_type.toUpperCase()].join("|");
}

function defaultPrivilegeKey(row: ProjectLocalDefaultTablePrivilegeRow): string {
  return [
    row.owner_name,
    row.schema_name,
    normalizeGrantee(row.grantee),
    row.privilege_type.toUpperCase(),
  ].join("|");
}

export const projectLocalExpectedDirectTablePrivileges = Object.freeze(
  Object.entries(projectLocalTablePrivilegeContract.directPrivileges).flatMap(
    ([tableName, grants]) =>
      projectLocalProtectedGrantees.flatMap((grantee) =>
        grants[grantee].map((privilege) => ({
          table_name: tableName,
          grantee,
          privilege_type: privilege,
        })),
      ),
  ),
);

export const projectLocalExpectedDefaultTablePrivileges = Object.freeze(
  projectLocalProtectedGrantees.flatMap((grantee) =>
    projectLocalTablePrivilegeContract.defaultTablePrivileges[grantee].map((privilege) => ({
      owner_name: projectLocalTablePrivilegeContract.creatorRole,
      schema_name: projectLocalTablePrivilegeContract.schema,
      grantee,
      privilege_type: privilege,
    })),
  ),
);

export function compareProjectLocalDirectTablePrivileges(
  actualRows: readonly ProjectLocalTablePrivilegeRow[],
) {
  const expected = new Map(
    projectLocalExpectedDirectTablePrivileges.map((row) => [directPrivilegeKey(row), row]),
  );
  const actual = new Map(actualRows.map((row) => [directPrivilegeKey(row), row]));

  return {
    unexpected: [...actual.entries()]
      .filter(([key]) => !expected.has(key))
      .map(([, row]) => row),
    missing: [...expected.entries()]
      .filter(([key]) => !actual.has(key))
      .map(([, row]) => row),
  };
}

export function compareProjectLocalDefaultTablePrivileges(
  actualRows: readonly ProjectLocalDefaultTablePrivilegeRow[],
) {
  const expected = new Map(
    projectLocalExpectedDefaultTablePrivileges.map((row) => [defaultPrivilegeKey(row), row]),
  );
  const actual = new Map(actualRows.map((row) => [defaultPrivilegeKey(row), row]));

  return {
    unexpected: [...actual.entries()]
      .filter(([key]) => !expected.has(key))
      .map(([, row]) => row),
    missing: [...expected.entries()]
      .filter(([key]) => !actual.has(key))
      .map(([, row]) => row),
  };
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildProjectLocalDirectTablePrivilegeQuery(): string {
  const tables = projectLocalTableNames.map(sqlLiteral).join(", ");
  const grantees = projectLocalProtectedGrantees.map(sqlLiteral).join(", ");
  return `select relation.relname as table_name,
       coalesce(grantee.rolname, 'PUBLIC') as grantee,
       expanded.privilege_type
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
cross join lateral pg_catalog.aclexplode(coalesce(relation.relacl, pg_catalog.acldefault('r', relation.relowner))) as expanded
left join pg_catalog.pg_roles as grantee on grantee.oid = expanded.grantee
where namespace.nspname = ${sqlLiteral(projectLocalTablePrivilegeContract.schema)}
  and relation.relkind in ('r', 'p')
  and relation.relname in (${tables})
  and coalesce(grantee.rolname, 'PUBLIC') in (${grantees})
order by relation.relname, grantee, expanded.privilege_type;`;
}

export function buildProjectLocalDefaultTablePrivilegeQuery(): string {
  const grantees = projectLocalProtectedGrantees.map(sqlLiteral).join(", ");
  return `select owner_role.rolname as owner_name,
       namespace.nspname as schema_name,
       coalesce(grantee.rolname, 'PUBLIC') as grantee,
       expanded.privilege_type
from pg_catalog.pg_default_acl as defaults
join pg_catalog.pg_roles as owner_role on owner_role.oid = defaults.defaclrole
join pg_catalog.pg_namespace as namespace on namespace.oid = defaults.defaclnamespace
cross join lateral pg_catalog.aclexplode(defaults.defaclacl) as expanded
left join pg_catalog.pg_roles as grantee on grantee.oid = expanded.grantee
where defaults.defaclobjtype = 'r'
  and owner_role.rolname = ${sqlLiteral(projectLocalTablePrivilegeContract.creatorRole)}
  and namespace.nspname = ${sqlLiteral(projectLocalTablePrivilegeContract.schema)}
  and coalesce(grantee.rolname, 'PUBLIC') in (${grantees})
order by grantee, expanded.privilege_type;`;
}
