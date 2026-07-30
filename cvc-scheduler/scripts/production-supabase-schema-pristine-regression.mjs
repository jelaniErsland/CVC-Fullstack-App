import assert from "node:assert/strict";

import {
  assertExpectedRemoteMigrationHistory,
  readRemoteMigrationHistory,
} from "./production-supabase-schema-regression.mjs";

function querySequence(rowsByCall) {
  let call = 0;
  return (sql, stage) => {
    call += 1;
    assert(typeof sql === "string" && sql.length > 0, "Regression query seam received an empty SQL string.");
    assert(typeof stage === "string" && stage.startsWith("Production migration-history"), "Regression query seam received an unsafe stage label.");
    const next = rowsByCall.shift();
    if (next instanceof Error) throw next;
    assert(next, `Unexpected extra query call ${call}.`);
    return next;
  };
}

const pristineHistory = readRemoteMigrationHistory(
  querySequence([[{ exists: false }]]),
);
assert.deepEqual(pristineHistory, [], "Missing migration-history table must be interpreted as pristine history.");
assert.doesNotThrow(
  () => assertExpectedRemoteMigrationHistory(pristineHistory),
  "Pristine history should be a valid pre-migration state.",
);

assert.throws(
  () => readRemoteMigrationHistory(querySequence([new Error("database session refused")])),
  /database session refused/,
  "An actual migration-history existence query failure must not be converted into pristine history.",
);

assert.throws(
  () =>
    readRemoteMigrationHistory(
      querySequence([[{ exists: true }], new Error("migration table read failed")]),
    ),
  /migration table read failed/,
  "A real migration-history table read failure must fail closed.",
);

assert.throws(
  () => assertExpectedRemoteMigrationHistory(["20260701000000"]),
  /Unexpected production migration history before gate/,
  "Unexpected partial remote migration history must fail closed.",
);

assert.throws(
  () =>
    readRemoteMigrationHistory(
      querySequence([[{ exists: true }], [{ version: "not-a-version" }]]),
    ),
  /malformed version/,
  "Malformed remote migration versions must fail closed.",
);

assert.doesNotThrow(
  () => assertExpectedRemoteMigrationHistory(["20260714122230"]),
  "Already-migrated production history should remain a valid read-only validation state.",
);

console.log("Production Supabase pristine migration-history handling checks passed.");
