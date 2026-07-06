import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASSIGNMENT_DETAIL_ROUTE_CONTRACT_AVAILABLE,
  ASSIGNMENT_DETAIL_ROUTE_IMPLEMENTATION_AVAILABLE,
  ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION,
} from "../lib/assignments/detailRoutePolicy.server.ts";
import {
  RESPONSE_LINK_ASSIGNMENT_DETAIL_CONTEXT_AVAILABLE,
  RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE,
} from "../lib/responseTokens/productSurfacePolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_CONTRACT_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_UI_AVAILABLE,
} from "../lib/responseTokens/productActionPolicy.server.ts";
import { RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE } from "../lib/responseTokens/revealPolicy.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routeRelativePath = "app/admin/assignments/[assignmentId]/page.tsx";
const routePath = path.join(root, ...routeRelativePath.split("/"));
const routeSource = await readFile(routePath, "utf8");

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

assert.match(routeSource, /export const dynamic = "force-dynamic"/);
assert.match(routeSource, /export const revalidate = 0/);
assert.match(routeSource, /export const fetchCache = "force-no-store"/);
assert.doesNotMatch(routeSource, /generateStaticParams/);
assert.match(
  routeSource,
  /import \{ readAssignmentDetailContext \} from "@\/lib\/assignments\/detailContext\.server"/,
);
assert.match(routeSource, /readAssignmentDetailContext\(\{\s*assignmentId:/s);
assert.match(routeSource, /readProjectContactSession\(\)/);
assert.match(routeSource, /session\.status !== "authenticated"/);
assert.match(routeSource, /Assignment unavailable/);
assert.match(routeSource, /Assignment details are read-only here/);
assert.doesNotMatch(routeSource, /AdminShell|mockData|volunteerPreview/);
assert.doesNotMatch(routeSource, /@\/lib\/responseTokens\//);
assert.doesNotMatch(
  routeSource,
  /createAuditedAssignmentResponseLinkReveal|issueAssignmentResponseLink|replaceAssignmentResponseToken|recordAssignmentResponseLinkRevealAudit|reveal_assignment_response_link|read_assignment_detail_context|assignment_response_tokens|\.rpc\(|\.from\(/,
);
assert.doesNotMatch(
  routeSource,
  /SUPABASE_SERVICE_ROLE_KEY|serviceRole|createServiceRole|navigator\.clipboard|clipboard\.writeText|Copy response link|Copy full link/i,
);
assert.doesNotMatch(
  routeSource,
  /rawBearer|fullResponseUrl|redactedResponseUrl|responseTokenId|tokenVerifierHash|tokenScope|accessToken|refreshToken|serviceRoleKey|emergencyContact|questionnaireAnswers|sensitiveIntakeData|auditInternals/,
);

const appAndComponentFiles = [];
for (const directory of ["app", "components"]) {
  appAndComponentFiles.push(
    ...(await collectFiles(path.join(root, directory))).filter((file) =>
      /\.(?:ts|tsx)$/.test(file),
    ),
  );
}

const contextImporters = [];
const inboundLinks = [];
for (const file of appAndComponentFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  if (
    source.includes("lib/assignments/detailContext") ||
    source.includes("readAssignmentDetailContext")
  ) {
    contextImporters.push(relative);
  }
  if (relative !== routeRelativePath && source.includes("/admin/assignments/")) {
    inboundLinks.push(relative);
  }
}

assert.deepEqual(contextImporters, [routeRelativePath]);
assert.deepEqual(inboundLinks, []);
assert.equal(ASSIGNMENT_DETAIL_ROUTE_CONTRACT_AVAILABLE, true);
assert.equal(ASSIGNMENT_DETAIL_ROUTE_IMPLEMENTATION_AVAILABLE, true);
assert.equal(ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION, false);
assert.equal(RESPONSE_LINK_ASSIGNMENT_DETAIL_CONTEXT_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_CONTRACT_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_IMPLEMENTATION_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_UI_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE, false);
assert.equal(RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE, false);

console.log("Persisted assignment-detail route shell checks passed.");
console.log("Confirmed one approved context importer, no inbound product links, and no response-link behavior.");
