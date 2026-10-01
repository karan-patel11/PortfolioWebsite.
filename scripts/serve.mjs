import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT must be a valid TCP port.');
const {basePath=''} = JSON.parse(await readFile(path.join(root,'site-config.json'),'utf8').catch(()=>'{}'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

// Development-only fixtures are never included in production output.
async function fixture(html, params) {
  let css = await readFile(path.join(root, 'style.css'), 'utf8');
  let script = await readFile(path.join(root, 'main.js'), 'utf8');
  if (params.get('motion') === 'reduce') {
    css = css.replaceAll(/\(prefers-reduced-motion:\s*reduce\)/g, ' all');
    script = script.replace("matchMedia('(prefers-reduced-motion: reduce)')", "({ matches: true, addEventListener() {} })");
  }
  if (params.get('text') === '200') css += '\nhtml { font-size: 200%; }';
  if (params.has('spacing')) css += '\n* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }';
  if (params.has('text') || params.has('spacing') || params.has('motion')) {
    html = html.replace(/<link rel="stylesheet" href="[^"]*\/style.css">/, `<style>${css}</style>`);
  }
  if (params.get('js') === 'off' || params.get('motion') === 'reduce') {
    html = html.replaceAll(/<script[\s\S]*?<\/script>/g, '');
    if (params.get('js') !== 'off') html = html.replace('</body>', `<script type="module">${script.replaceAll("from './", `from '${basePath}/`)}</script></body>`);
  }
  if (params.has('slow')) html = html.replaceAll(/(src|href)="(\/[^"#]+\.(?:css|js|webp))"/g, '$1="$2?slow=1"').replaceAll(/(\/assets\/[^\s]+\.webp) (\d+w)/g, '$1?slow=1 $2');
  if (params.has('metrics')) html = html.replace('</body>', `<script>${await readFile('scripts/qa-metrics.js','utf8')}</script></body>`);
  return html;
}
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = basePath && (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`)) ? url.pathname.slice(basePath.length)||'/' : url.pathname;
    const requested = pathname === '/__qa/' ? '/' : pathname;
    let file = path.resolve(root, '.' + decodeURIComponent(requested));
    if (!file.startsWith(root + path.sep) && file !== root) throw Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    let body = await readFile(file);
    if (url.searchParams.has('slow') && url.pathname !== '/__qa/') await new Promise(resolve => setTimeout(resolve, 1200));
    if (pathname === '/__qa/') body = await fixture(body.toString(), url.searchParams);
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(port, '0.0.0.0', () => console.log(`Local: http://localhost:${port}${basePath}/`));
