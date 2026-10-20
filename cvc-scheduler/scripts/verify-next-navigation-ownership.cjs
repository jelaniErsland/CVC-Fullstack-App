// Build-entry verification, independent of compiler module/transform caches.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Next config also runs in CommonJS environments.
const { readFileSync } = require('node:fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Keep the verifier usable by both Next build paths.
const { createHash } = require('node:crypto');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Resolve only this installation's Next package.
const path = require('node:path');
const reviewRequired = "Project Local's guarded Next.js router correction requires review before building.";
const approvedVersion = '16.2.7';
const sources = [
  ['dist/client/components/app-router-instance.js',
    '3143533797e0339ffc9f7d70772f3b6fd04e7268a7d396788b4641a47d482570',
    '8552ab3abcbafbdb4a259aca6a7f781ee29e60ff850cc66d4f523bab84f390f2'],
  ['dist/esm/client/components/app-router-instance.js',
    '34eee1e7ca47d2980794df475c2068e909b19adf19fbc41ebc712f5a507276d8',
    'c5a427eca6a05ea30ec91d4df8752f3a0d06cf729e7bd47d2a24fb04722e76fa'],
];
const hash = value => createHash('sha256').update(value).digest('hex');

module.exports = function verifyNextNavigationOwnership() {
  try {
    const packagePath = require.resolve('next/package.json');
    // Read fresh bytes on EVERY invocation, even if this verifier/Next was
    // previously required in the same process. Never memoize this result.
    const { version } = JSON.parse(readFileSync(packagePath, 'utf8'));
    if (version !== approvedVersion) throw new Error(`Expected Next.js ${approvedVersion}; found ${version}.`);
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Exercise the exact existing compiler correction without writing it to disk.
    const transform = require('./next-navigation-ownership-loader.cjs');
    for (const [relativePath, originalHash, correctedHash] of sources) {
      const source = readFileSync(path.join(path.dirname(packagePath), relativePath), 'utf8').replaceAll('\r\n', '\n');
      if (hash(source) !== originalHash) throw new Error(`Unexpected upstream source: ${relativePath}.`);
      const corrected = transform(source);
      if (hash(corrected) !== correctedHash || transform(source) !== corrected) {
        throw new Error(`Correction is unexpected or nondeterministic: ${relativePath}.`);
      }
    }
  } catch (error) {
    throw new Error(`${reviewRequired} ${error.message}`, { cause: error });
  }
  console.info(`Project Local: verified guarded Next.js ${approvedVersion} router source`);
};
