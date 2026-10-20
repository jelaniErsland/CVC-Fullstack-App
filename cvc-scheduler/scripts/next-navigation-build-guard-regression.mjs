import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'project-local-router-guard-'));
const next = path.join(sandbox, 'node_modules/next');
const scripts = path.join(sandbox, 'scripts');
const files = ['dist/client/components/app-router-instance.js', 'dist/esm/client/components/app-router-instance.js'];
const sources = files.map(file => fs.readFileSync(require.resolve(`next/${file}`), 'utf8'));
try {
  fs.mkdirSync(scripts, { recursive: true });
  for (const file of ['verify-next-navigation-ownership.cjs', 'next-navigation-ownership-loader.cjs']) {
    fs.copyFileSync(new URL(file, import.meta.url), path.join(scripts, file));
  }
  for (const [index, file] of files.entries()) {
    fs.mkdirSync(path.dirname(path.join(next, file)), { recursive: true });
    fs.writeFileSync(path.join(next, file), sources[index]);
  }
  const packagePath = path.join(next, 'package.json');
  fs.writeFileSync(packagePath, JSON.stringify({ version: '16.2.7' }));
  // Execute the actual config factory too: a standalone verifier test must not
  // stay green if someone accidentally removes its build-entry wiring.
  const { PHASE_PRODUCTION_BUILD } = require('next/constants');
  fs.writeFileSync(path.join(next, 'constants.js'), `module.exports = ${JSON.stringify({ PHASE_PRODUCTION_BUILD })};`);
  const { outputText } = require('typescript').transpileModule(fs.readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: require('typescript').ModuleKind.CommonJS, esModuleInterop: true },
  });
  fs.writeFileSync(path.join(sandbox, 'next.config.cjs'), outputText);
  const configure = require(path.join(sandbox, 'next.config.cjs')).default;
  const buildEntry = () => configure(PHASE_PRODUCTION_BUILD);
  const verify = require(path.join(scripts, 'verify-next-navigation-ownership.cjs'));
  const patch = require(path.join(scripts, 'next-navigation-ownership-loader.cjs'));
  const denied = () => {
    for (const invoke of [verify, buildEntry]) assert.throws(invoke, /Project Local's guarded Next\.js router correction requires review before building\./);
  };
  verify(); buildEntry(); buildEntry(); // Cached modules must still inspect fresh bytes.
  for (const [index, file] of files.entries()) {
    const target = path.join(next, file), original = sources[index];
    for (const changed of [original + '\n// mismatch', original.replace('if (action.discarded)', 'if (false)'), patch(original)]) {
      fs.writeFileSync(target, changed); denied();
      fs.writeFileSync(target, original); verify();
    }
    fs.unlinkSync(target); denied();
    assert(configure('phase-production-server'), 'Build-only source verification must not become a production-server requirement.');
    fs.writeFileSync(target, original); verify();
  }
  fs.writeFileSync(packagePath, JSON.stringify({ version: '16.2.8' })); denied();
  fs.writeFileSync(packagePath, JSON.stringify({ version: '16.2.7' })); verify();
  // Guard the exact expected correction too, independently of upstream hashes.
  const verifierSource = fs.readFileSync(path.join(scripts, 'verify-next-navigation-ownership.cjs'), 'utf8');
  fs.writeFileSync(path.join(scripts, 'verify-next-navigation-ownership.cjs'), verifierSource.replace('8552ab3abcbafbdb4a259aca6a7f781ee29e60ff850cc66d4f523bab84f390f2', '0'.repeat(64)));
  delete require.cache[require.resolve(path.join(scripts, 'verify-next-navigation-ownership.cjs'))];
  assert.throws(require(path.join(scripts, 'verify-next-navigation-ownership.cjs')), /requires review before building.*unexpected or nondeterministic/);
  files.forEach((file, index) => assert.equal(fs.readFileSync(path.join(next, file), 'utf8'), sources[index]));
  console.log('Build-entry guard: both inputs, missing/changed/modified targets, version, corrected output, repeated invocation and restoration pass; installed sources untouched.');
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
