// Metadata-only heuristic history scan. Never emit candidate text or credential values.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const cwd = 'C:/FYP/travelmate-compound-request';
const out = `${cwd}/docs/freeze-plan/testing-security-audit-20261018/history-secret-scan.json`;
const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const entries = git(['rev-list', '--objects', '--all']).trim().split('\n').map(line => {
  const split = line.indexOf(' '); return { id: split < 0 ? line : line.slice(0, split), path: split < 0 ? '' : line.slice(split + 1) };
});
const byId = new Map(entries.map(row => [row.id, row.path]));
const types = execFileSync('git', ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], {
  cwd, input: entries.map(row => row.id).join('\n') + '\n', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}).trim().split('\n');
const report = { scope: 'all locally reachable refs including local-only branches; unique historical blobs; no network',
  method: 'heuristic credential URL, JWT, private key, provider-key and literal secret assignment scan; candidate values withheld',
  scannedTextBlobs: 0, skippedBinaryOrLarge: 0, secretEnvironmentPaths: [], candidates: [], limitations: ['not proof of absence', 'unreachable/deleted objects, remote-only refs, large/binary blobs and obfuscated secrets excluded', 'synthetic/placeholder labels are heuristics; review needed for unclassified candidates'] };
for (const line of types) {
  const [id, type, size] = line.split(' ');
  if (type !== 'blob') continue;
  const path = byId.get(id) ?? '';
  if (/(^|\/)\.env(?:$|\.(?!example$))/.test(path)) report.secretEnvironmentPaths.push({ blob: id, path });
  if (Number(size) > 2 * 1024 * 1024) { report.skippedBinaryOrLarge++; continue; }
  const buffer = execFileSync('git', ['cat-file', 'blob', id], { cwd, maxBuffer: 3 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  if (buffer.includes(0)) { report.skippedBinaryOrLarge++; continue; }
  const text = buffer.toString('utf8'); report.scannedTextBlobs++;
  const rules = [
    ['credential_url', /postgres(?:ql)?:\/\/[^\s'"@/:]+:([^\s'"@]+)@[^\s'"/]+/g],
    ['jwt_token', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
    ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ['provider_key', /\b(?:AIza[A-Za-z0-9_-]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{32,})\b/g],
    ['literal_secret', /(?:JWT_SECRET|API_KEY|SECRET_KEY|PGPASSWORD)\s*[:=]\s*["']([^"'\r\n]{8,})["']/g],
  ];
  for (const [rule, pattern] of rules) for (const match of text.matchAll(pattern)) {
    let classification = /(^|\/)(?:test|tests)\//.test(path) ? 'synthetic-test-fixture' : /\.env\.example$|README|docs\//.test(path) ? 'example-or-documentation-review' : 'needs-human-review';
    const candidate = match[1] ?? '';
    if (/^(?:postgres|password|pass|p|test|test-password|your[_-].*|replace.*|change.*|[.$}{%]+)$/i.test(candidate)) classification = 'obvious-placeholder';
    report.candidates.push({ blob: id, path, rule, line: text.slice(0, match.index).split('\n').length, classification });
  }
}
report.candidateCounts = Object.fromEntries([...new Set(report.candidates.map(row => row.classification))].map(key => [key, report.candidates.filter(row => row.classification === key).length]));
mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ scannedTextBlobs: report.scannedTextBlobs, skippedBinaryOrLarge: report.skippedBinaryOrLarge, environmentPaths: report.secretEnvironmentPaths.length, candidateCounts: report.candidateCounts }));
