// Servidor de produção de UM app (portal, totem, painel ou pesquisa) — sem dependências.
//
//   SGA_APP=portal API_URL=https://api.exemplo/api/v1 PORT=8080 node servidor.mjs
//
// - Serve dist/<app>/browser (gerado por `ng build <app>`).
// - Rotas do app (/a/TOKEN, /atendimento...) devolvem o index.html (SPA).
// - /config.js sai com o endereço da API tirado de API_URL: o mesmo build vale
//   para qualquer ambiente.
// - Arquivos com hash no nome ficam em cache por 1 ano; index e config, nunca.
// - Compacta com gzip os textos quando o navegador aceita.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const app = process.env.SGA_APP || process.argv[2];
if (!['portal', 'totem', 'painel', 'pesquisa'].includes(app)) {
  console.error('Informe o app em SGA_APP: portal, totem, painel ou pesquisa.');
  process.exit(1);
}
const raiz = join(process.cwd(), 'dist', app, 'browser');
const porta = Number(process.env.PORT || 8080);
const apiUrl = (process.env.API_URL || '').trim() || null;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};
const COMPACTAVEL = new Set(['.html', '.js', '.mjs', '.css', '.json', '.txt', '.svg', '.map']);
const COM_HASH = /-[A-Z0-9]{8,}\.(js|css|mjs)$/i; // main-ABC12345.js, chunk-XYZ…

const cache = new Map(); // caminho -> { corpo, gzip }
async function arquivo(caminho) {
  if (cache.has(caminho)) return cache.get(caminho);
  const corpo = await readFile(caminho);
  const item = { corpo, gzip: COMPACTAVEL.has(extname(caminho)) && corpo.length > 1024 ? gzipSync(corpo) : null };
  cache.set(caminho, item);
  return item;
}

function responder(req, res, status, cabecalhos, corpo, gzip) {
  const aceitaGzip = gzip && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const saida = aceitaGzip ? gzip : corpo;
  res.writeHead(status, {
    ...cabecalhos,
    'Content-Length': saida.length,
    'X-Content-Type-Options': 'nosniff',
    ...(gzip ? { Vary: 'Accept-Encoding' } : {}),
    ...(aceitaGzip ? { 'Content-Encoding': 'gzip' } : {}),
  });
  res.end(req.method === 'HEAD' ? undefined : saida);
}

const configJs = Buffer.from(`window.__SGA_CONFIG__ = ${JSON.stringify({ apiUrl })};\n`);

createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    const rota = decodeURIComponent(new URL(req.url || '/', 'http://local').pathname);

    if (rota === '/config.js') {
      return responder(req, res, 200, { 'Content-Type': TIPOS['.js'], 'Cache-Control': 'no-store' }, configJs, null);
    }
    if (rota === '/saude') {
      return responder(req, res, 200, { 'Content-Type': TIPOS['.txt'], 'Cache-Control': 'no-store' }, Buffer.from('ok'), null);
    }

    const pedido = normalize(join(raiz, rota));
    if (pedido !== raiz && !pedido.startsWith(raiz + sep)) {
      res.writeHead(400);
      return res.end();
    }
    let alvo = pedido;
    let ehArquivo = false;
    try {
      ehArquivo = (await stat(alvo)).isFile();
    } catch {
      ehArquivo = false;
    }
    if (!ehArquivo) {
      // arquivo inexistente com extensão (ex.: /logo.png) é 404; rota do app volta o index
      if (extname(rota)) {
        res.writeHead(404, { 'Content-Type': TIPOS['.txt'] });
        return res.end('não encontrado');
      }
      alvo = join(raiz, 'index.html');
    }
    const { corpo, gzip } = await arquivo(alvo);
    const ext = extname(alvo);
    const cacheControl = ext === '.html' ? 'no-cache' : COM_HASH.test(alvo) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
    return responder(req, res, 200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': cacheControl }, corpo, gzip);
  } catch (erro) {
    console.error(erro);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(porta, '0.0.0.0', () => {
  console.log(`SGA ${app} em http://0.0.0.0:${porta} (API: ${apiUrl ?? 'mesmo host, porta 3000'})`);
});
