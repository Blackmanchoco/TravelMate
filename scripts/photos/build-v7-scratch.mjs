// One-time, guarded v6 -> photo overlay -> v7 preparation. No demo/main connection.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
const require = createRequire(`${root}/backend/package.json`);
const { Client } = require('pg');
const database = 'travelmate_scratch_20261019_finalalias'; // Must match apply-photo-overlay.mjs.
const v6Directory = 'C:/FYP/travelmate-private-backups/2026-10-06-demo';
const v6Dump = `${v6Directory}/travelmate_demo_20261016_seeded_v6.dump`;
const v7Directory = 'C:/FYP/travelmate-private-backups/2026-10-20-demo-v7';
const v7Dump = `${v7Directory}/travelmate_demo_20261020_seeded_v7.dump`;
const expectedV6 = 'D84F90858E142741F0DC5B5F68D77BEDD16D4971F658778E5365F0DCD4826D34';
const expectedCounts = '2|1|6|56|0|1|3|0';

function sha256(path) { return createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase(); }
function run(command, args, env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', windowsHide: true, timeout: 180_000 });
  if (result.status !== 0) throw Error(`${command.toUpperCase().replace(/[^A-Z]/g, '_')}_FAILED`);
}
function originalBackupHashes() {
  return Object.fromEntries(readdirSync(v6Directory).filter(name => statSync(`${v6Directory}/${name}`).isFile())
    .map(name => [name, sha256(`${v6Directory}/${name}`)]));
}
function safeConnection() {
  const line = readFileSync('C:/FYP/travelmate/backend/.env', 'utf8').split(/\r?\n/)
    .find(value => /^DATABASE_URL=/.test(value));
  if (!line) throw Error('SOURCE_SETTING_MISSING');
  const url = new URL(line.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, ''));
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.pathname !== '/travelmate'
    || [...url.searchParams.keys()].some(key => key !== 'schema')) throw Error('SOURCE_GUARD');
  url.pathname = `/${database}`;
  process.env.DATABASE_URL = url.toString();
  return { host: url.hostname === '[::1]' ? '::1' : '127.0.0.1',
    port: Number(url.port || 5432), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password) };
}
function pgEnvironment(connection) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG[A-Z0-9_]*$/i.test(key)));
  return { ...env, PGHOST: connection.host, PGHOSTADDR: connection.host,
    PGPORT: String(connection.port), PGUSER: connection.user, PGPASSWORD: connection.password };
}
async function inspect(client) {
  const counts = await client.query(`SELECT (SELECT count(*) FROM users) AS users,
    (SELECT count(*) FROM user_preferences) AS preferences,
    (SELECT count(*) FROM destinations) AS destinations,
    (SELECT count(*) FROM places) AS places,
    (SELECT count(*) FROM saved_places) AS saved,
    (SELECT count(*) FROM itineraries) AS itineraries,
    (SELECT count(*) FROM itinerary_items) AS items,
    (SELECT count(*) FROM admin_audit_logs) AS audits`);
  const countText = Object.values(counts.rows[0]).join('|');
  const places = await client.query(`SELECT id, "imageUrl", to_jsonb(p) - 'imageUrl' AS unchanged
    FROM places p ORDER BY id`);
  const publicRows = await client.query(`SELECT id, "imageUrl" FROM places
    WHERE "deletedAt" IS NULL AND lower(btrim(category)) <> 'test' ORDER BY id`);
  return { countText, places: places.rows, publicRows: publicRows.rows };
}

const report = { database, v6Hash: null, baseline: null, dryRun: null, apply: null,
  repeat: null, final: null, v7Hash: null, v6FolderHashesUnchanged: false,
  scratchDatabaseRetained: false };
let admin;
let scratch;
try {
  if (existsSync(v7Directory)) throw Error('V7_DIRECTORY_ALREADY_EXISTS');
  const initialBackupHashes = originalBackupHashes();
  report.v6Hash = sha256(v6Dump);
  const sidecar = readFileSync(`${v6Dump}.sha256`, 'utf8').trim().toUpperCase();
  if (report.v6Hash !== expectedV6 || sidecar !== expectedV6) throw Error('V6_HASH_MISMATCH');
  const connection = safeConnection();
  const env = pgEnvironment(connection);
  admin = new Client({ ...connection, database: 'postgres' });
  await admin.connect();
  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database]);
  if (existing.rowCount) {
    if (!process.argv.includes('--resume-owned')) throw Error('SCRATCH_ALREADY_EXISTS');
    report.scratchDatabaseRetained = true;
  } else {
    if (process.argv.includes('--resume-owned')) throw Error('SCRATCH_RESUME_TARGET_MISSING');
    await admin.query(`CREATE DATABASE "${database}"`);
    report.scratchDatabaseRetained = true;
    run('pg_restore', ['--single-transaction', '--exit-on-error', '--no-owner', '--no-privileges', '-d', database, v6Dump], env);
  }
  scratch = new Client({ ...connection, database });
  await scratch.connect();
  if ((await scratch.query('SELECT current_database() AS name')).rows[0].name !== database) throw Error('SCRATCH_TARGET_MISMATCH');
  const baseline = await inspect(scratch);
  report.baseline = { counts: baseline.countText, discoverable: baseline.publicRows.length,
    realPhotos: baseline.publicRows.filter(row => row.imageUrl !== null).length };
  if (report.baseline.counts !== expectedCounts || report.baseline.discoverable !== 56 || report.baseline.realPhotos !== 9) {
    throw Error('V6_BASELINE_MISMATCH');
  }
  const { runPhotoOverlay } = await import('./apply-photo-overlay.mjs');
  report.dryRun = await runPhotoOverlay();
  if (report.dryRun.changedRows !== 34 || report.dryRun.alreadyCurrentRows !== 0) throw Error('OVERLAY_DRY_RUN_MISMATCH');
  report.apply = await runPhotoOverlay({ apply: true });
  report.repeat = await runPhotoOverlay();
  if (report.apply.changedRows !== 34 || report.repeat.changedRows !== 0
    || report.repeat.alreadyCurrentRows !== 34) throw Error('OVERLAY_REPEAT_MISMATCH');
  const final = await inspect(scratch);
  const beforeStable = JSON.stringify(baseline.places.map(row => [row.id, row.unchanged]));
  const afterStable = JSON.stringify(final.places.map(row => [row.id, row.unchanged]));
  const actualPhotos = final.publicRows.filter(row => row.imageUrl !== null);
  const place102 = final.publicRows.find(row => row.id === 102);
  report.final = { counts: final.countText, discoverable: final.publicRows.length,
    realPhotos: actualPhotos.length, place102ImageUrl: place102?.imageUrl ?? null,
    otherPlaceFieldsUnchanged: beforeStable === afterStable };
  if (report.final.counts !== expectedCounts || report.final.discoverable !== 56
    || report.final.realPhotos !== 43 || !place102 || place102.imageUrl !== null
    || !report.final.otherPlaceFieldsUnchanged) throw Error('V7_CONTENT_MISMATCH');
  mkdirSync(v7Directory);
  run('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '-d', database, '-f', v7Dump], env);
  run('pg_restore', ['--list', v7Dump], env);
  report.v7Hash = sha256(v7Dump);
  writeFileSync(`${v7Dump}.sha256`, report.v7Hash);
  report.v6FolderHashesUnchanged = JSON.stringify(initialBackupHashes) === JSON.stringify(originalBackupHashes());
  if (!report.v6FolderHashesUnchanged) throw Error('V6_FOLDER_CHANGED');
  console.log(JSON.stringify(report));
} catch (error) {
  console.log(`STOP ${/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'V7_BUILD_ERROR'}`);
  process.exitCode = 1;
} finally {
  if (scratch) await scratch.end().catch(() => {});
  if (admin) await admin.end().catch(() => {});
  delete process.env.DATABASE_URL;
}
