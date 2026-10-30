import { createRequire } from 'node:module';

// Same-origin serving of the compiled frontend and compiled API; no database configuration here.
export function createBuiltApp(apiApp, root) {
  const express = createRequire(`${root}/backend/package.json`)('express');
  const fixture = express();
  fixture.disable('x-powered-by');
  fixture.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  fixture.use((req, res, next) => req.path.startsWith('/api/') ? apiApp(req, res, next) : next());
  fixture.use(express.static(`${root}/dist`));
  fixture.use((_req, res) => res.sendFile(`${root}/dist/index.html`));
  return fixture;
}
