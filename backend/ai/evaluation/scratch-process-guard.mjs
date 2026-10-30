// Preloaded in child Node processes before dotenv or application imports.
import { createRequire } from 'node:module';
const expected = process.env.SCRATCH_EVAL_DATABASE;
if (!/^travelmate_scratch_\d{17}$/.test(expected ?? '')) throw Error('SCRATCH_PROCESS_NAME_REJECTED');
function check(url) {
  let name;
  try { name = new URL(url).pathname.slice(1); } catch { throw Error('SCRATCH_PROCESS_URL_REJECTED'); }
  if (name !== expected || name === 'travelmate' || name.startsWith('travelmate_demo')) throw Error('SCRATCH_PROCESS_TARGET_REJECTED');
}
check(process.env.DATABASE_URL);
const pg = createRequire(new URL('../../package.json', import.meta.url))('pg');
const connect = pg.Pool.prototype.connect;
pg.Pool.prototype.connect = function (...args) {
  check(process.env.DATABASE_URL);
  if (this.options.connectionString) check(this.options.connectionString);
  else if (this.options.database !== expected) throw Error('SCRATCH_PROCESS_POOL_REJECTED');
  return connect.apply(this, args);
};
