// Only the owned, exact-name scratch database may receive imageUrl updates.
// A manifest row requires a reviewed local JPEG and matching public credit entry.
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
const database = 'travelmate_scratch_20261019_finalalias';
const require = createRequire(`${root}/backend/package.json`);
const { Client } = require('pg');
const manifest = JSON.parse(readFileSync(`${root}/docs/freeze-plan/final-fixes-20261019/PHOTO_MANIFEST.json`, 'utf8'));
const credits = JSON.parse(readFileSync(`${root}/public/images/credits.json`, 'utf8'));
const approvedLicenses = new Map([
  ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'],
  ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  ['CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
]);

export function validatePhotoLicense(license, licenseUrl) {
  return typeof license === 'string' && typeof licenseUrl === 'string'
    && approvedLicenses.get(license) === licenseUrl;
}

function validateTarget() {
  const url = new URL(process.env.DATABASE_URL ?? 'invalid:');
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.pathname !== `/${database}`
    || [...url.searchParams.keys()].some(key => key !== 'schema')) throw Error('SCRATCH_TARGET_REJECTED');
  return url;
}

function validateManifest() {
  if (!Array.isArray(manifest)) throw Error('PHOTO_MANIFEST_INVALID');
  const seen = new Set();
  for (const row of manifest) {
    if (typeof row !== 'object' || !row) throw Error('PHOTO_MANIFEST_ROW_INVALID');
    if (typeof row.place !== 'string' || typeof row.destination !== 'string'
      || !/^\/images\/places\/[a-z0-9-]+\.jpg$/.test(row.imageUrl)
      || row.sourceType !== 'commons'
      || typeof row.sourcePageUrl !== 'string' || typeof row.author !== 'string'
      || typeof row.license !== 'string' || typeof row.licenseUrl !== 'string'
      || typeof row.creditText !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.dateRetrieved)) {
      throw Error('PHOTO_MANIFEST_ROW_INVALID');
    }
    const retrieved = new Date(`${row.dateRetrieved}T00:00:00Z`);
    if ([row.place, row.destination, row.sourcePageUrl, row.author, row.license, row.licenseUrl, row.creditText]
      .some(value => !value.trim()) || !row.sourcePageUrl.startsWith('https://')
      || !row.licenseUrl.startsWith('https://')
      || Number.isNaN(retrieved.getTime()) || retrieved.toISOString().slice(0, 10) !== row.dateRetrieved) {
      throw Error('PHOTO_MANIFEST_ROW_INVALID');
    }
    const source = new URL(row.sourcePageUrl);
    if (source.protocol !== 'https:' || source.hostname !== 'commons.wikimedia.org'
      || source.username || source.password || !source.pathname.startsWith('/wiki/File:')
      || !validatePhotoLicense(row.license, row.licenseUrl)) throw Error('PHOTO_SOURCE_OR_LICENSE_REJECTED');
    const key = `${row.destination}\0${row.place}`;
    if (seen.has(key)) throw Error('PHOTO_MANIFEST_DUPLICATE');
    seen.add(key);
    const matches = credits.filter(item => item.file === row.imageUrl);
    const credit = matches[0];
    if (matches.length !== 1 || credit.author !== row.author || credit.license !== row.license
      || credit.licenseUrl !== row.licenseUrl || credit.sourcePageUrl !== row.sourcePageUrl
      || credit.dateRetrieved !== row.dateRetrieved || credit.creditText !== row.creditText) {
      throw Error('PHOTO_CREDIT_MISSING_OR_MISMATCHED');
    }
    const path = `${root}/public${row.imageUrl}`;
    const bytes = readFileSync(path);
    if (statSync(path).size >= 300_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw Error('PHOTO_FILE_INVALID');
    }
  }
}

export async function runPhotoOverlay({ apply = false } = {}) {
  const url = validateTarget();
  validateManifest();
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  let changed = 0;
  let unchanged = 0;
  try {
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    for (const row of manifest) {
      if (validateTarget().pathname !== `/${database}`) throw Error('SCRATCH_TARGET_REJECTED');
      const found = await client.query(`SELECT p.id, p."imageUrl" FROM places p
        JOIN destinations d ON d.id = p."destinationId"
        WHERE p.name=$1 AND d.name=$2 AND p."deletedAt" IS NULL AND lower(btrim(p.category)) <> 'test'
        ${apply ? 'FOR UPDATE OF p' : ''}`, [row.place, row.destination]);
      if (found.rows.length !== 1) throw Error('PHOTO_PLACE_MISSING_OR_AMBIGUOUS');
      if (found.rows[0].imageUrl === row.imageUrl) { unchanged++; continue; }
      if (found.rows[0].imageUrl !== null) throw Error('PHOTO_EXISTING_IMAGE_REJECTED');
      changed++;
      if (apply) await client.query('UPDATE places SET "imageUrl"=$1 WHERE id=$2', [row.imageUrl, found.rows[0].id]);
    }
    if (apply) await client.query('COMMIT'); else await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
  return { mode: apply ? 'apply' : 'dry-run', database, manifestRows: manifest.length, changedRows: changed, alreadyCurrentRows: unchanged };
}

if (process.argv[1] && fileURLToPath(import.meta.url).replaceAll('\\', '/') === process.argv[1].replaceAll('\\', '/')) {
  try { console.log(JSON.stringify(await runPhotoOverlay({ apply: process.argv.includes('--apply') }))); }
  catch (error) { console.log(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'PHOTO_OVERLAY_ERROR'); process.exitCode = 1; }
}
