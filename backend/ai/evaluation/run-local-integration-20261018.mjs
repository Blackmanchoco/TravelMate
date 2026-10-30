// Scratch-only live API evaluation. Never log connection configuration or raw exceptions.
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { safeEvaluationStop } from './safe-evaluation-stop.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const backend = `${root}/backend`;
const db = `travelmate_scratch_${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}`;
const mode = process.argv.includes('--audit') ? 'audit' : process.argv.includes('--t1-red') ? 't1-red' : process.argv.includes('--t1') ? 't1' : process.argv.includes('--integrated') ? 'integrated' : process.argv.includes('--alias-baseline') ? 'alias-baseline' : process.argv.includes('--alias-red') ? 'alias-red' : process.argv.includes('--alias') ? 'alias'
  : process.argv.includes('--red') ? 'red' : process.argv.includes('--legacy') ? 'legacy'
  : process.argv.includes('--supplement-only') ? 'supplement-only' : 'verified';
const out = `${root}/docs/freeze-plan/${mode === 'audit' ? 'testing-security-audit-20261018' : ['t1-red','t1','integrated'].includes(mode) ? 'local-integration-20261018' : mode.startsWith('alias') ? 'explore-alias-20261018' : 'compound-supplement-20261018'}/${mode}-${db}`;
mkdirSync(out, { recursive: true });
const ascii = value => JSON.stringify(value, null, 2).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const summary = { startedAt: new Date().toISOString(), database: db, created: false, dropped: false,
  plannedCases: mode === 'audit' ? 48 : ['t1', 'integrated'].includes(mode) ? 35 : mode === 'legacy' ? 65 : mode.endsWith('red') ? 0 : mode.startsWith('alias') ? 7 : 26,
  plannedRows: mode === 'audit' ? 48 : ['t1', 'integrated'].includes(mode) ? 35 : mode === 'legacy' ? 195 : mode.endsWith('red') ? 0 : mode.startsWith('alias') ? 7 : 78, results: [], checks: [], stop: null };
const save = () => { writeFileSync(`${out}/summary.json`, ascii(summary)); writeFileSync(`${out}/attempt-${db}.json`, ascii(summary)); };
const fail = (code, reason) => { throw Object.assign(new Error(code), { reason }); };
const assertName = () => {
  if (connection && [...connection.searchParams.keys()].some(key => key !== 'schema')) fail('CONNECTION_QUERY_OVERRIDE_REJECTED');
  if (!/^travelmate_scratch_\d{17}$/.test(db) || db === 'travelmate' || db.startsWith('travelmate_demo')) fail('SCRATCH_NAME_REJECTED');
};
let connection, admin, server, prisma, appEnv;
const require = createRequire(`${backend}/package.json`);
const pg = require('pg');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase();
const originalRaw = 'C:/FYP/travelmate-private-evidence/final-20261016/2026-10-16T14-00-07-511Z.jsonl';
const expectedRawHash = '471913F7ECAC18252B336CD8249AA76E7708B72F9DC43F4E3CC5B7AE6B37F97D';
const snapshot = 'C:/FYP/travelmate-private-backups/2026-10-06-demo/travelmate_demo_20261016_seeded_v6.dump';
const expectedSnapshotHash = 'D84F90858E142741F0DC5B5F68D77BEDD16D4971F658778E5365F0DCD4826D34';
function redact(text) {
  let result = String(text);
  for (const secret of [connection?.toString(), connection ? decodeURIComponent(connection.password) : null, process.env.JWT_SECRET]) {
    if (secret) result = result.split(secret).join('[REDACTED]');
  }
  return result.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[REDACTED_CONNECTION]')
    .replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
const assertEnvironment = () => {
  assertName();
  if (!summary.created || new URL(process.env.DATABASE_URL).pathname !== `/${db}`) fail('SCRATCH_ENV_REJECTED');
};
function command(executable, args, cwd, filename) {
  assertEnvironment();
  try {
    const result = spawnSync(executable === 'npm.cmd' ? process.execPath : executable,
      executable === 'npm.cmd' ? [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), ...args] : args,
      { cwd, env: { ...process.env, DATABASE_URL: connection.toString() },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000, windowsHide: true });
    writeFileSync(`${out}/${filename}.txt`, redact(`${result.stdout ?? ''}\n${result.stderr ?? ''}`));
    if (result.status !== 0) {
      if (filename.startsWith('red-')) {
        summary.checks.push({ name: filename, exitCode: result.status, expectedFailure: true }); save(); return;
      }
      fail(`CHECK_FAILED_${filename}`);
    }
    summary.checks.push({ name: filename, exitCode: 0 }); save();
    console.log(`${filename}: PASS`);
    return result.stdout;
  } catch (error) {
    if (filename === 'red-trip-length-tests') {
      let log = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
      for (const secret of [connection.toString(), decodeURIComponent(connection.password), process.env.JWT_SECRET]) {
        if (secret) log = log.split(secret).join('[REDACTED]');
      }
      log = log.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[REDACTED_CONNECTION]');
      writeFileSync(`${out}/red-tests.txt`, log);
      summary.checks.push({ name: filename, exitCode: error.status, expectedFailure: true }); save();
      return;
    }
    fail(`CHECK_FAILED_${filename}`);
  }
}
async function adminQuery(query, params = []) {
  assertName();
  // Maintenance connection is exclusively used for this run's create/drop and database-name catalog queries.
  if (admin.connectionParameters.database !== 'postgres') fail('MAINTENANCE_TARGET_REJECTED');
  return admin.query(query, params);
}
const actualFetch = globalThis.fetch;
let modelCalls = 0;
globalThis.fetch = async (input, options) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url?.startsWith('http://127.0.0.1:11434/api/chat')) modelCalls++;
  return actualFetch(input, options);
};
const originalPoolConnect = pg.Pool.prototype.connect;
pg.Pool.prototype.connect = function (...args) {
  assertEnvironment();
  const target = this.options.connectionString ? new URL(this.options.connectionString).pathname.slice(1) : this.options.database;
  if (target !== db) fail('POOL_TARGET_REJECTED');
  return originalPoolConnect.apply(this, args);
};

try {
  assertName();
  // Read ONLY DATABASE_URL; never import other .env values or persist the URL.
  const line = readFileSync('C:/FYP/travelmate/backend/.env', 'utf8').split(/\r?\n/).find(s => /^DATABASE_URL=/.test(s));
  if (!line) fail('CONNECTION_SETTING_MISSING');
  connection = new URL(line.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, ''));
  if (!['postgres:', 'postgresql:'].includes(connection.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname)
    || connection.pathname !== '/travelmate') fail('CONNECTION_SOURCE_REJECTED');
  assertName();
  connection.pathname = `/${db}`;
  process.env.DATABASE_URL = connection.toString();
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.VITE_API_BASE_URL = '/api';
  process.env.DOTENV_CONFIG_PATH = `${root}/.local-data/nonexistent-overnight.env`;
  mkdirSync(`${root}/.local-data`, { recursive: true });
  process.chdir(`${root}/.local-data`);
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
  process.env.OLLAMA_MODEL = 'qwen3:8b';
  process.env.PYTHON_EXECUTABLE = 'C:/FYP/travelmate/backend/.venv/Scripts/python.exe';
  summary.environmentGuard = {
    connectionQuery: 'Only schema query option accepted; connection host/user/database overrides rejected before every connection',
    dotenv: 'default non-overriding; DOTENV_CONFIG_PATH points to nonexistent file',
    application: 'DATABASE_URL replaced in process memory before any import or child spawn; each child explicitly receives it',
    pool: 'pg.Pool.connect validates owned scratch name and configured target before every application pool connection',
    maintenance: 'postgres maintenance connection only: pg_database names and exact owned CREATE/DROP; no main/demo connection',
    childOutput: 'withheld entirely; only named exit statuses recorded',
  }; save();
  if (hash(originalRaw) !== expectedRawHash) fail('ORIGINAL_RAW_HASH_MISMATCH');
  summary.originalRawHashBefore = expectedRawHash;
  summary.phase = 'snapshot-hash';
  if (hash(snapshot) !== expectedSnapshotHash) fail('SNAPSHOT_HASH_MISMATCH');
  summary.phase = 'maintenance-connect';
  const baseConfig = { host: connection.hostname, port: Number(connection.port || 5432),
    user: decodeURIComponent(connection.username), password: decodeURIComponent(connection.password), database: 'postgres' };
  assertName();
  admin = new pg.Client(baseConfig);
  await admin.connect();
  summary.databaseNamesBefore = (await adminQuery('SELECT datname FROM pg_database ORDER BY datname')).rows.map(r => r.datname);
  if (summary.databaseNamesBefore.includes(db)) fail('SCRATCH_ALREADY_EXISTS');
  await adminQuery(`CREATE DATABASE "${db}"`);
  summary.created = true; save();
  process.env.SCRATCH_EVAL_DATABASE = db;
  process.env.PYTHONPATH = `${backend}/ai/evaluation/python-scratch-guard`;
  assertEnvironment();
  Object.assign(process.env, { PGHOST: baseConfig.host, PGPORT: String(baseConfig.port), PGUSER: baseConfig.user, PGPASSWORD: baseConfig.password });
  if (mode === 't1-red') {
    command('npm.cmd', ['test', '--', 'test/place-detail-visibility.test.ts'], backend, 'red-t1-tests');
    if (!summary.checks.some(check => check.expectedFailure)) fail('EXPECTED_RED_TESTS_DID_NOT_FAIL');
    fail('EXPECTED_RED_TESTS_RECORDED');
  }
  if (mode === 'red') {
    command('npm.cmd', ['test', '--', 'test/ai-category-safety.test.ts'], backend, 'red-trip-length-tests');
    if (!summary.checks.some(check => check.expectedFailure)) fail('EXPECTED_RED_TESTS_DID_NOT_FAIL');
    fail('EXPECTED_RED_TESTS_RECORDED');
  }
  if (mode === 'alias-red') {
    command('npm.cmd', ['test', '--', 'test/place-search-alias.test.ts'], backend, 'red-alias-tests');
    if (!summary.checks.some(check => check.expectedFailure)) fail('EXPECTED_RED_TESTS_DID_NOT_FAIL');
    fail('EXPECTED_RED_TESTS_RECORDED');
  }
  command('pg_restore', ['--single-transaction', '--exit-on-error', '--no-owner', '--no-privileges', '-d', db, snapshot], backend, 'scratch-v6-restore');
  if (process.argv.includes('--lint-check')) command('npm.cmd', ['run', 'lint'], root, 'frontend-lint');
  if (!process.argv.includes('--api-only') && (mode === 'verified' || mode === 'alias' || mode === 't1' || mode === 'integrated')) {
    command('npm.cmd', ['test'], backend, 'backend-tests');
    command('npm.cmd', ['run', 'typecheck'], backend, 'backend-typecheck');
    command('npm.cmd', ['run', 'lint'], root, 'frontend-lint');
    if (mode === 'integrated') {
      command(process.execPath, ['--test', 'scripts/photos/placeholder.test.mjs'], root, 'frontend-placeholder-tests');
      command(process.execPath, ['node_modules/typescript/bin/tsc', '-b', '--pretty', 'false'], root, 'frontend-typecheck');
      command(process.env.PYTHON_EXECUTABLE, ['-m', 'unittest', 'discover', '-s', 'ai/recommendation', '-p', 'test_*.py'], backend, 'python-recommender-tests');
      command(process.env.PYTHON_EXECUTABLE, ['-m', 'unittest', 'discover', '-s', 'ai/data', '-p', 'test_*.py'], backend, 'python-candidate-tests');
    }
    command('npm.cmd', ['run', 'build'], root, 'frontend-build');
  }
  command('npm.cmd', ['run', 'build'], backend, 'backend-build');
  const { prisma: client } = await import(pathToFileURL(`${backend}/dist/lib/prisma.js`).href);
  prisma = client;
  assertEnvironment();
  const baseline = await prisma.$queryRawUnsafe('SELECT current_database() AS name, (SELECT count(*)::int FROM places WHERE "deletedAt" IS NULL AND lower(btrim(category)) <> \'test\') AS places');
  if (baseline[0].name !== db || baseline[0].places !== 56) fail('SCRATCH_BASELINE_MISMATCH');
  summary.baseline = { database: db, discoverablePlaces: 56 }; save();
  if (mode === 'integrated') {
    const smoke = await prisma.$queryRawUnsafe('SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM user_preferences) AS preferences, (SELECT count(*)::int FROM destinations) AS destinations, (SELECT count(*)::int FROM places WHERE "deletedAt" IS NOT NULL) AS archived, (SELECT count(*)::int FROM itineraries) AS itineraries, (SELECT count(*)::int FROM itinerary_items) AS items, (SELECT count(*)::int FROM saved_places) AS saved');
    summary.v6Smoke = { ...smoke[0], discoverable: 56 }; save();
    if (Object.values(smoke[0]).join('|') !== '2|1|6|0|1|3|0') fail('SCRATCH_V6_SMOKE_MISMATCH');
  }
  const categoryApi = await import(pathToFileURL(`${backend}/dist/modules/ai/ai.category.js`).href);
  ({ env: appEnv } = await import(pathToFileURL(`${backend}/dist/config/env.js`).href));
  if (appEnv.databaseUrl !== connection.toString()) fail('CONFIG_OVERRIDE_FAILED');
  const { app } = await import(pathToFileURL(`${backend}/dist/app.js`).href);
  let servingApp = app;
  if (mode === 'integrated') {
    const { createBuiltApp } = await import(pathToFileURL(`${root}/scripts/demo/built-app.mjs`).href);
    servingApp = createBuiltApp(app, root);
  }
  // Ephemeral loopback-only port; no existing demo listener is altered.
  server = await new Promise((resolve, reject) => { const s = servingApp.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject); });
  summary.port = server.address().port;
  async function post(path, body, token, method = 'POST') {
    assertEnvironment();
    const response = await actualFetch(`http://127.0.0.1:${summary.port}/api${path}`, { method,
      headers: { 'Content-Type': 'application/json', Connection: 'close', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(135_000) });
    return { status: response.status, payload: await response.json() };
  }
  const password = randomBytes(24).toString('base64url') + 'aA1!';
  const auth = await post('/auth/register', { name: 'Scratch Evaluation', email: `scratch-${randomBytes(8).toString('hex')}@travelmate.test`, password });
  if (auth.status !== 201 || !auth.payload.data?.token) fail('SCRATCH_ACCOUNT_SETUP_FAILED');
  const token = auth.payload.data.token;
  const preferences = await post('/users/me/preferences', { interests: ['Culture', 'Nature'], preferredActivities: ['sightseeing'], travelStyle: 'Relaxed', budget: 'Moderate' }, token, 'PUT');
  if (preferences.status !== 200) fail('SCRATCH_PREFERENCES_SETUP_FAILED');
  if (mode === 'audit') {
    const { runAuditChecks } = await import('./audit-api-checks.mjs');
    await runAuditChecks({ base: `http://127.0.0.1:${summary.port}/api`, tokenA: token, userA: auth.payload.data.user.id, prisma, jwt: require('jsonwebtoken'), secret: process.env.JWT_SECRET, assertEnvironment, onCase: row => {
      summary.results.push(row); save();
      appendFileSync(`${out}/api-results.jsonl`, ascii(row).replace(/\n/g, '') + '\n');
      appendFileSync(`${root}/docs/api-test-record-2026-09-11/README.md`, `\n- ${new Date().toISOString()} | audit ${row.caseId} | ${row.pass ? 'PASS' : 'FAIL'} | owned scratch=${db}`);
      console.log(`${row.caseId}: ${row.pass ? 'PASS' : 'FAIL'}`);
    } });
  } else if (mode === 't1' || mode === 'integrated') {
    const { runPlaceVisibilityChecks } = await import('./place-visibility-api-checks.mjs');
    await runPlaceVisibilityChecks({ backend, base: `http://127.0.0.1:${summary.port}/api`, prisma, token, userId: auth.payload.data.user.id, assertEnvironment, onCase: row => {
      summary.results.push(row); save();
      appendFileSync(`${out}/visibility-results.jsonl`, ascii(row).replace(/\n/g, '') + '\n');
      console.log(`${row.caseId}: ${row.pass ? 'PASS' : 'FAIL'}`);
      appendFileSync(`${root}/docs/api-test-record-2026-09-11/README.md`, `\n- ${new Date().toISOString()} | visibility ${row.caseId} | ${row.pass ? 'PASS' : 'FAIL'} | owned scratch=${db}`);
    } });
    if (mode === 'integrated') {
      const { runIntegratedBrowserChecks } = await import('./integrated-browser-checks.mjs');
      summary.browser = await runIntegratedBrowserChecks({ base: `http://127.0.0.1:${summary.port}`, prisma, token, user: auth.payload.data.user, out, assertEnvironment });
      save();
    }
  } else if (mode.startsWith('alias')) {
    const { runAliasChecks } = await import('./alias-api-checks.mjs');
    await runAliasChecks({ backend, base: `http://127.0.0.1:${summary.port}/api`, prisma, baselineOnly: mode === 'alias-baseline',
      assertEnvironment, onCase: row => {
        summary.results.push(row); save();
        appendFileSync(`${out}/alias-results.jsonl`, ascii(row).replace(/\n/g, '') + '\n');
        console.log(`${row.caseId}: ${row.pass === undefined ? 'BASELINE' : row.pass ? 'PASS' : 'FAIL'}`);
        appendFileSync(`${root}/docs/api-test-record-2026-09-11/README.md`, `\n- ${new Date().toISOString()} | alias ${row.caseId} | ${row.pass === undefined ? 'BASELINE' : row.pass ? 'PASS' : 'FAIL'} | scratch=${db}; evidence=docs/freeze-plan/explore-alias-20261018`);
      } });
  } else {
  // Warm-up calls only Ollama and does not start/restart/alter demo processes.
  command('npm.cmd', ['run', 'warm-ai'], backend, 'ollama-warm-up');
  if (mode === 'legacy') {
    assertEnvironment();
    const warmBegan = performance.now();
    const pythonWarm = spawnSync(process.env.PYTHON_EXECUTABLE, [`${backend}/ai/recommendation/recommendation_runner.py`], {
      cwd: backend, env: { ...process.env, DATABASE_URL: connection.toString() },
      input: JSON.stringify({ userId: auth.payload.data.user.id, limit: 5, destinationId: 2 }),
      encoding: 'utf8', timeout: 60_000, windowsHide: true });
    let warmPayload;
    try { warmPayload = JSON.parse(pythonWarm.stdout); } catch { fail('PYTHON_WARMUP_INVALID_OUTPUT'); }
    if (pythonWarm.status !== 0 || warmPayload.ok !== true) fail('PYTHON_WARMUP_FAILED');
    summary.checks.push({ name: 'python-warm-up', exitCode: 0, durationMs: Math.round(performance.now() - warmBegan) });
    save(); console.log('python-warm-up: PASS');
    // Original evaluator file and all case definitions are untouched: it includes
    // original183 rows plus the four previously accepted compound cases(12rows).
    summary.phase = 'legacy-create-no-preference-account'; save();
    const noPrefPassword = randomBytes(24).toString('base64url') + 'aA1!';
    const noPrefEmail = `scratch-${randomBytes(8).toString('hex')}@travelmate.test`;
    const noPref = await post('/auth/register', { name: 'Scratch No Preferences', email: noPrefEmail, password: noPrefPassword });
    if (noPref.status !== 201) fail('REGRESSION_ACCOUNT_SETUP_FAILED');
    summary.phase = 'legacy-configure-credentials-in-memory'; save();
    const preferenceEmail = auth.payload.data.user.email;
    Object.assign(process.env, { AI_EVAL_EMAIL: noPrefEmail, AI_EVAL_PASSWORD: noPrefPassword,
      AI_EVAL_PREFERENCE_EMAIL: preferenceEmail, AI_EVAL_PREFERENCE_PASSWORD: password,
      AI_EVAL_API_BASE: `http://127.0.0.1:${summary.port}/api`, AI_EVAL_POST_IMPORT: '1',
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: root });
    summary.phase = 'legacy-create-evidence-directory'; save();
    const rawDir = `${root}/.local-data/regression-${db}`;
    mkdirSync(rawDir, { recursive: true });
    const recordPath = `${root}/docs/api-test-record-2026-09-11/README.md`;
    const recordBefore = readFileSync(recordPath, 'utf8');
    summary.regressionSourceHashBefore = hash(`${backend}/ai/evaluation/evaluate_ai_conversation.mjs`);
    const exit = await new Promise((resolve, reject) => {
      assertEnvironment();
      const child = spawn(process.execPath, [`--import=${pathToFileURL(`${backend}/ai/evaluation/scratch-process-guard.mjs`).href}`, `${backend}/ai/evaluation/evaluate_ai_conversation.mjs`, rawDir], {
        cwd: backend, env: { ...process.env, DATABASE_URL: connection.toString() }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let pending = '';
      child.stdout.on('data', chunk => {
        pending += String(chunk);
        const lines = pending.split('\n'); pending = lines.pop();
        for (const line of lines) if (/^[a-z0-9_]+ [1-3]\/3 (?:PASS|FAIL)$/.test(line.trim())) {
          console.log(line.trim());
          if (line.trim().endsWith(' FAIL')) child.kill();
        }
      });
      child.stderr.on('data', () => {}); // never forward potential raw exceptions
      child.once('error', () => reject(Error('REGRESSION_CHILD_START_FAILED')));
      child.once('exit', code => resolve(code));
    });
    // Escape only newly appended human-readable API log; old bytes and raw files untouched.
    const recordAfter = readFileSync(recordPath, 'utf8');
    writeFileSync(recordPath, recordBefore + recordAfter.slice(recordBefore.length).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`));
    const rawName = readdirSync(rawDir).find(name => name.endsWith('.jsonl'));
    if (!rawName) fail('REGRESSION_NO_RAW_FILE');
    const rawPath = `${rawDir}/${rawName}`;
    const rows = readFileSync(rawPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    summary.regressionRawHash = hash(rawPath);
    summary.regressionRawPath = rawPath;
    summary.regressionSourceHashAfter = hash(`${backend}/ai/evaluation/evaluate_ai_conversation.mjs`);
    const classified = rows.map(row => ({ ...row,
      responseOrigin: row.kind === 'tool' ? 'direct tool' : row.caseId.startsWith('compound_') || categoryApi.requestedCategory(row.message)
        || /^(?:This comparison covers only|\u672c\u6b21\u6bd4\u8f83\u4ec5\u9650|These places are in TravelMate's live data\.|TravelMate catalogue matches|These are TravelMate catalogue matches)/u.test(row.reply ?? '')
        || row.toolsUsed?.some(t => t.status === 'error' || t.resultCount === 0) ? 'server-rule' : 'model-authored',
      originBasis: row.kind === 'tool' ? 'Direct tool evaluation' : 'Reconstructed from unchanged handler paths; initial model participation differs from response authorship' }));
    writeFileSync(`${out}/regression-classified.jsonl`, classified.map(row => ascii(row).replace(/\n/g, '')).join('\n') + '\n');
    summary.results = classified.map(row => ({ caseId: row.caseId, iteration: row.iteration, pass: row.pass, responseOrigin: row.responseOrigin }));
    summary.plannedRows = 195; summary.plannedCases = 65;
    const counts = group => ({ completed: group.length, passed: group.filter(row => row.pass).length,
      failed: group.filter(row => !row.pass).length, origins: Object.fromEntries(['server-rule', 'model-authored', 'direct tool'].map(origin => [origin, group.filter(row => row.responseOrigin === origin).length])) });
    summary.original183 = counts(classified.filter(row => !row.caseId.startsWith('compound_')));
    summary.earlierCompound12 = counts(classified.filter(row => row.caseId.startsWith('compound_')));
    const failed = classified.find(row => !row.pass);
    if (failed) fail(`EVALUATION_STOP_${failed.caseId}_${failed.iteration}`, 'Regression assertion failed');
    if (exit !== 0 || rows.length !== 195) fail('REGRESSION_INCOMPLETE');
    save();
  } else {
  const cases = JSON.parse(readFileSync(`${backend}/ai/evaluation/compound-supplement-20261018.cases.json`, 'utf8'));
  summary.plannedCases = cases.length; summary.plannedRows = cases.length * 3;
  summary.caseFileHash = hash(`${backend}/ai/evaluation/compound-supplement-20261018.cases.json`);
  summary.sourceHash = hash(`${backend}/src/modules/ai/ai.service.ts`);
  const en = 'This chat cannot build a schedule; use Itinerary and Add to choose days and slots.';
  const zh = '\u804a\u5929\u65e0\u6cd5\u7f16\u6392\u884c\u7a0b\uff1b\u8bf7\u4f7f\u7528 Itinerary \u548c Add \u9009\u62e9\u65e5\u671f\u548c\u65f6\u6bb5\u3002';
  for (const test of cases) {
    for (let iteration = 1; iteration <= 3; iteration++) {
      let expected, originBasis;
      if (test.category) {
        assertEnvironment();
        const places = await prisma.place.findMany({ where: { deletedAt: null, category: test.category, destination: { name: 'Penang' } }, orderBy: [{ rating: 'desc' }, { id: 'asc' }] });
        if (places.length !== 3) fail('EXPECTED_CATEGORY_FIXTURE_MISMATCH');
        // All Penang hotels/restaurants fit the existing limit:3. Ordering is checked against the actual tool query below.
        const tools = await import(pathToFileURL(`${backend}/dist/modules/ai/ai.tools.js`).href);
        const direct = await tools.executeSearchPlacesTool({ destination: 'Penang', category: test.category, limit: 5 }, 5000);
        const content = JSON.parse(direct.content);
        if (!content.ok || content.items.length !== 3) fail('DIRECT_CATALOGUE_SETUP_FAILED');
        expected = categoryApi.formatCategoryReply({ category: test.category, destination: 'Penang', names: content.items.map(p => p.name),
          totalMatches: content.totalMatches ?? content.resultCount, availableCategories: content.availableCategories ?? [], chinese: /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(test.message) });
        if (test.compound) expected += `\n\n${/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(test.message) ? zh : en}`;
        originBasis = 'ai.service category branch returns formatCategoryReply through withScheduleLimitation; initial model wording is discarded';
      } else {
        expected = 'The recommendation service is temporarily unavailable. Please try again later.';
        originBasis = 'exact fixed toolFallbackReply and get_personalized_recommendations error metadata; initial model call recorded separately';
      }
      const previousPython = appEnv.pythonExecutable;
      if (test.forcedUnavailable) appEnv.pythonExecutable = `${root}/.local-data/nonexistent-python.exe`;
      modelCalls = 0;
      const started = performance.now();
      let result;
      try { result = await post('/ai/chat', { message: test.message, history: [] }, token); }
      finally { appEnv.pythonExecutable = previousPython; }
      const data = result.payload.data ?? {};
      const relevantTool = data.toolsUsed?.find(t => t.name === (test.forcedUnavailable ? 'get_personalized_recommendations' : 'search_places'));
      const correctTool = test.forcedUnavailable
        ? relevantTool?.status === 'error' && relevantTool?.errorCode === 'PERSONALIZED_RECOMMENDATIONS_FAILED'
        : relevantTool?.status === 'success' && relevantTool?.arguments.category === test.category && relevantTool?.resultCount === 3;
      const fixedRule = test.category ? data.reply?.startsWith('TravelMate') : data.reply === expected;
      const row = { caseId: test.id, iteration, message: test.message, status: result.status,
        reply: data.reply, expected, toolsUsed: data.toolsUsed, suggestedPlaces: data.suggestedPlaces,
        responseOrigin: fixedRule ? 'server-rule' : 'model-authored', originBasis: fixedRule ? originBasis : 'Response did not match the inspected deterministic return; inspect raw reply before claiming authorship',
        modelCallCount: modelCalls, model: data.model, forcedUnavailable: !!test.forcedUnavailable,
        durationMs: Math.round(performance.now() - started),
        pass: result.status === 200 && data.reply === expected && !!correctTool && modelCalls >= 1 };
      appendFileSync(`${out}/supplement.jsonl`, ascii(row).replace(/\n/g, '') + '\n');
      summary.results.push({ caseId: row.caseId, iteration, pass: row.pass, responseOrigin: row.responseOrigin }); save();
      appendFileSync(`${root}/docs/api-test-record-2026-09-11/README.md`, `\n- ${new Date().toISOString()} | separate compound ${row.caseId} ${iteration}/3 | ${row.pass ? 'PASS' : 'FAIL'} | HTTP ${row.status}; origin=${row.responseOrigin}; scratch=${db}; evidence=docs/freeze-plan/compound-supplement-20261018/supplement.jsonl`);
      console.log(`${test.id} ${iteration}/3 ${row.pass ? 'PASS' : 'FAIL'} origin=${row.responseOrigin}`);
      if (!row.pass) fail(`EVALUATION_STOP_${test.id}_${iteration}`, result.status !== 200 ? 'HTTP status mismatch'
        : data.reply !== expected ? 'Fixed reply mismatch' : !correctTool ? 'Tool usage mismatch' : 'Missing model call');
    }
  }
  }
  }
} catch (error) {
  // Unknown exceptions are never serialized: database errors may contain secrets.
  summary.stop = safeEvaluationStop(error);
  if (['TypeError', 'ReferenceError', 'RangeError'].includes(error?.name)) summary.errorType = error.name;
  if (/^[A-Z0-9_]+$/.test(error?.cause?.code ?? '')) summary.errorCauseCode = error.cause.code;
  if (/^[A-Z0-9_]+$/.test(error?.code ?? '')) summary.errorCode = error.code;
  console.log(`STOP: ${typeof summary.stop === 'string' ? summary.stop : JSON.stringify(summary.stop)}`); process.exitCode = 1;
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (prisma) await prisma.$disconnect().catch(() => { summary.disconnectError = true; });
  if (summary.created && admin) {
    try {
      assertName();
      await adminQuery(`DROP DATABASE "${db}" WITH (FORCE)`);
      summary.databaseNamesAfter = (await adminQuery('SELECT datname FROM pg_database ORDER BY datname')).rows.map(r => r.datname);
      summary.dropped = !summary.databaseNamesAfter.includes(db);
      console.log('SERVER_DATABASE_NAMES_ONLY: ' + summary.databaseNamesAfter.join(', '));
    } catch { summary.cleanupError = 'SCRATCH_CLEANUP_FAILED'; process.exitCode = 1; }
  }
  if (admin) await admin.end().catch(() => {});
  try { summary.originalRawHashAfter = hash(originalRaw); summary.originalRawUnchanged = summary.originalRawHashAfter === expectedRawHash; }
  catch { summary.originalRawCheckUnavailable = true; }
  summary.finishedAt = new Date().toISOString();
  summary.completed = summary.results.length;
  summary.passed = summary.results.filter(r => r.pass).length;
  summary.failed = summary.results.filter(r => r.pass === false).length;
  summary.observations = summary.results.filter(r => r.pass === undefined || r.observation).length;
  summary.assertions = summary.results.filter(r => r.pass !== undefined && !r.observation).length;
  summary.notRun = summary.plannedRows - summary.completed;
  summary.origins = Object.fromEntries(['server-rule', 'model-authored', 'direct tool'].map(origin => [origin, summary.results.filter(r => r.responseOrigin === origin).length]));
  save();
  delete process.env.DATABASE_URL; delete process.env.PGPASSWORD; delete process.env.JWT_SECRET;
  globalThis.fetch = actualFetch; pg.Pool.prototype.connect = originalPoolConnect;
  console.log(JSON.stringify({ completed: summary.completed, passed: summary.passed, failed: summary.failed,
    notRun: summary.notRun, stop: summary.stop, dropped: summary.dropped, originalRawUnchanged: summary.originalRawUnchanged }));
}
