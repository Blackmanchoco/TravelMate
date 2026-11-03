import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBuiltApp } from './built-app.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
// User-run launcher. The caller supplies the reviewed demo URL in memory; never fall back to main.
let connection;
try { connection = new URL(process.env.DATABASE_URL ?? 'invalid:'); }
catch { throw Error('A valid explicit local demo connection is required.'); }
if (!['postgres:', 'postgresql:'].includes(connection.protocol)
  || !['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname)
  || !/^\/travelmate_demo_\d{8}$/.test(connection.pathname)
  || [...connection.searchParams.keys()].some(key => key !== 'schema')) {
  throw Error('A local, explicitly selected demo database is required.');
}
createRequire(`${root}/backend/package.json`)('dotenv').config();
const { app } = await import(pathToFileURL(`${root}/backend/dist/app.js`).href);
const port = Number(process.env.PORT ?? 5174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid listener port.');
const builtApp = createBuiltApp(app, root);
builtApp.disable('x-powered-by');
const server = builtApp.listen(port, '127.0.0.1', () => {
  console.log(`Reviewed compiled build: http://127.0.0.1:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
