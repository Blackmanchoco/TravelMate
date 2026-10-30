// Read-only reconciliation of every /credits row against the v7 scratch catalogue.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
const require = createRequire(`${root}/backend/package.json`);
const { Client } = require('pg');
const database = 'travelmate_scratch_20261019_finalalias';
const reportDir = `${root}/docs/freeze-plan/photo-import-20261020`;
const credits = JSON.parse(readFileSync(`${root}/public/images/credits.json`, 'utf8'));
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
const client = new Client({ connectionString: url.toString() });
try {
  await client.connect();
  if ((await client.query('SELECT current_database() AS name')).rows[0].name !== database) throw Error('TARGET_GUARD');
  await client.query('BEGIN READ ONLY');
  const destinations = (await client.query('SELECT id,name,"imageUrl" FROM destinations ORDER BY id')).rows
    .map(row => ({ kind: 'destination', ...row }));
  const places = (await client.query(`SELECT id,name,"imageUrl" FROM places
    WHERE "deletedAt" IS NULL AND lower(btrim(category)) <> 'test' ORDER BY id`)).rows
    .map(row => ({ kind: 'place', ...row }));
  const used = [...destinations, ...places].filter(row => row.imageUrl?.startsWith('/images/'));
  const invalidUrls = [...destinations, ...places].filter(row => row.imageUrl
    && !row.imageUrl.startsWith('/images/') && row.imageUrl !== '/destination-placeholder.svg');
  const byFile = new Map();
  for (const row of used) byFile.set(row.imageUrl, [...(byFile.get(row.imageUrl) ?? []), row]);
  const rows = credits.map((credit, index) => {
    const references = byFile.get(credit.file) ?? [];
    const fileExists = typeof credit.file === 'string' && existsSync(`${root}/public${credit.file}`);
    const metadataComplete = ['file', 'title', 'author', 'license', 'licenseUrl', 'sourcePageUrl']
      .every(key => typeof credit[key] === 'string' && credit[key].trim());
    return { pagePosition: index + 1, kind: references[0]?.kind ?? '', id: references[0]?.id ?? '',
      name: references[0]?.name ?? '', file: credit.file, creditTitle: credit.title,
      references: references.length, fileExists, metadataComplete };
  });
  const credited = new Set(credits.map(row => row.file));
  const uncredited = used.filter(row => !credited.has(row.imageUrl)).map(row => ({ kind: row.kind, id: row.id }));
  const summary = { visibleCredits: credits.length, usedImages: used.length,
    destinationImages: used.filter(row => row.kind === 'destination').length,
    placeImages: used.filter(row => row.kind === 'place').length,
    missingCreditCount: uncredited.length, orphanCreditCount: rows.filter(row => row.references !== 1).length,
    missingFileCount: rows.filter(row => !row.fileExists).length,
    incompleteMetadataCount: rows.filter(row => !row.metadataComplete).length,
    invalidUrlCount: invalidUrls.length,
    place13CreditPosition: rows.find(row => row.kind === 'place' && row.id === 13)?.pagePosition ?? null,
    place99CreditPosition: rows.find(row => row.kind === 'place' && row.id === 99)?.pagePosition ?? null };
  if (summary.visibleCredits !== 47 || summary.usedImages !== 47 || summary.destinationImages !== 4
    || summary.placeImages !== 43 || summary.missingCreditCount || summary.orphanCreditCount
    || summary.missingFileCount || summary.incompleteMetadataCount || summary.invalidUrlCount
    || summary.place13CreditPosition !== 27 || summary.place99CreditPosition !== 42) {
    throw Error(`RECONCILIATION_FAILED ${JSON.stringify(summary)}`);
  }
  const csvCell = value => `"${String(value).replaceAll('"', '""')}"`;
  const fields = ['pagePosition', 'kind', 'id', 'name', 'file', 'creditTitle', 'references', 'fileExists', 'metadataComplete'];
  const csv = [fields.join(','), ...rows.map(row => fields.map(key => csvCell(row[key])).join(','))].join('\n') + '\n';
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(`${reportDir}/CREDIT_RECONCILIATION.csv`, csv);
  writeFileSync(`${reportDir}/CREDIT_RECONCILIATION.json`, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary));
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end().catch(() => {});
  delete process.env.DATABASE_URL;
}
