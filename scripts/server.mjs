import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const preferredPort = Number(process.env.PORT || 5173);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/babel; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
};

const spriteMetadataPath = join(root, 'public', 'assets', 'sprites', 'reaction', 'metadata.json');
const spriteMetadataIds = new Set([
  'player_idle',
  'player_idle_variant_01',
  'player_idle_variant_02',
  'player_hadoken',
  'player_anti_air',
  'player_parry',
  'player_onhit',
  'opponent_idle',
  'opponent_idle_variant_01',
  'opponent_idle_variant_02',
  'opponent_dash_tell',
  'opponent_dash_active',
  'opponent_jump_tell',
  'opponent_jump_active',
  'opponent_hadoken',
  'opponent_onhit',
  'projectile_hadouken',
  'hitfx_parry_normal',
  'hitfx_parry_perfect',
  'hitfx_hadouken',
  'hitfx_anti_air_fire',
  'hitfx_melee',
]);
const spriteMetadataKeys = ['height', 'x', 'y'];

const readBody = (request) => new Promise((resolveBody, rejectBody) => {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 20_000) {
      rejectBody(new Error('Request body too large'));
      request.destroy();
    }
  });
  request.on('end', () => resolveBody(body));
  request.on('error', rejectBody);
});

const normalizeSpriteMetadata = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Metadata must be an object');
  }

  return Object.fromEntries([...spriteMetadataIds].map((id) => {
    const meta = value[id];
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      throw new Error(`Missing metadata for ${id}`);
    }

    return [id, Object.fromEntries(spriteMetadataKeys.map((key) => {
      const number = Number(meta[key]);
      if (!Number.isFinite(number)) {
        throw new Error(`Invalid ${key} for ${id}`);
      }
      return [key, Math.round(number)];
    }))];
  }));
};

const sendJson = (response, status, payload) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);

  if (request.method === 'POST' && url.pathname === '/api/sprite-metadata') {
    try {
      const body = await readBody(request);
      const metadata = normalizeSpriteMetadata(JSON.parse(body));
      await writeFile(spriteMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const requestedPath = decodeURIComponent(url.pathname);
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = resolve(join(root, safePath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, 'index.html');
  }

  response.writeHead(200, {
    'Content-Type': types[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
});

const listen = (port) => {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`Execution Frame Trainer running at ${url}`);

    if (process.env.OPEN === '1') {
      const command = process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
          ? `open "${url}"`
          : `xdg-open "${url}"`;

      exec(command);
    }
  });
};

listen(preferredPort);
