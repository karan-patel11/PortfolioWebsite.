import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';

const read = path => readFileSync(path, 'utf8');
const files = directory => readdirSync(directory).flatMap(name => {
  const file = join(directory, name);
  return statSync(file).isDirectory() ? files(file) : [file];
});
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"');
const text = value => decode(value.replaceAll(/<[^>]*>/g, ' ')).replaceAll(/\s+/g, ' ').trim();
const source = text(read('karan-patel-single-design-handoff/content/portfolio-content-final.txt'));
const htmlFiles = files('dist').filter(file => file.endsWith('.html'));
assert.equal(htmlFiles.length, 5, 'Home and four project routes');
let assertions = 0;
for (const file of htmlFiles) {
  const html = read(file);
  const publicText = text(html.replaceAll(/<script[\s\S]*?<\/script>/g, ''));
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${file}: one h1`);
  assert(!/[—–]|--|\[Repository Link\]|\[Email Address\]|undefined/.test(publicText), `${file}: no forbidden copy`);
  assert(!/QE Copilot|Qdrant|BGE embeddings|Jenkins/.test(publicText), `${file}: no unconfirmed skill or project`);
  for (const match of html.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const paragraph = text(match[2]);
    if (paragraph.length > 90 && !match[2].includes('<h')) {
      assert(source.includes(paragraph), `${file}: unsupported copy: ${paragraph}`);
      assertions++;
    }
  }
  for (const [, reference] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (reference.startsWith('https:')) continue;
    const [route, fragment] = reference.split('#');
    const target = route ? join('dist', route) : file;
    const targetFile = target.endsWith('/') ? target + 'index.html' : target;
    assert(existsSync(targetFile), `${file}: missing local target ${reference}`);
    if (fragment) assert(read(targetFile).includes(`id="${fragment}"`), `${file}: missing anchor ${reference}`);
  }
}
const home = read('dist/index.html');
const chapterIds = [...home.matchAll(/<section id="([^"]+)" class="chapter/g)].map(m => m[1]);
assert.deepEqual(chapterIds, ['about', 'education', 'experience', 'venture', 'projects', 'contact']);
assert.equal((home.match(/<details class="role">/g) || []).length, 4);
const nmims = home.match(/<article id="nmims">([\s\S]*?)<\/article>/)[1];
assert.equal(text(nmims), 'NMIMS Bachelor of Technology, Computer Engineering Jul 2018 to May 2024');
const allText = htmlFiles.map(file => text(read(file))).join(' ');
for (const bullet of read('karan-patel-single-design-handoff/content/portfolio-content-final.txt').split('\n').filter(line => line.startsWith('* '))) {
  assert(allText.includes(text(bullet.slice(2))), `Missing experience bullet: ${bullet}`);
}
for (const qualifier of ['6.9% realized miscoverage against a 10% target', 'Routing violations reduced to 14.7% vs. 57.2% baseline', '95.8% field-level accuracy when validated against SEC 10-K data across eight large-cap companies.']) {
  assert(allText.includes(qualifier), `Missing qualification: ${qualifier}`);
}
const heroJS = read('dist/hero.js');
assert(gzipSync(heroJS).length + gzipSync(read('dist/main.js')).length < 25000, 'Combined custom JS budget');
for (const hook of ['loading-base-overlay','hero-year','year-row','year-start-text','year-strip','hero-name','name-row','name-heading','loading-tagline','loading-journey-line','clock']) assert(home.includes(`data-${hook}`), `Missing hero hook ${hook}`);
const js = read('dist/main.js');
let animationCalls = 0;
const fakeElement = { animate() { animationCalls++; return { finished: Promise.resolve(), cancel() {} }; } };
const context = {
  document: { documentElement: { dataset: {} }, querySelector: () => null, querySelectorAll: selector => selector === 'main > section.chapter' ? [] : [fakeElement] },
  window: { addEventListener() {}, IntersectionObserver: true },
  matchMedia: () => ({ matches: true, addEventListener() {} }),
  IntersectionObserver: class { constructor() { throw Error('Reduced motion must not create an observer'); } },
};
runInNewContext(js, context);
assert.equal(animationCalls, 0, 'Reduced motion starts no animation');
assert(read('src/style.css').includes('@media(prefers-reduced-motion:reduce)'));
assert(!/requestAnimationFrame|setInterval|setTimeout/.test(js), 'No persistent animation loop');
const colors = ['#F3EEE8', '#C8C0B8', '#FAF9F6', '#EDEAE6', '#2E2B28', '#1F1D1B', '#3A3632'];
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
const pairs = [[colors[0],colors[5]],[colors[1],colors[5]],[colors[0],colors[6]],[colors[1],colors[6]],[colors[4],colors[2]],[colors[4],colors[3]]];
for (const [foreground, background] of pairs) assert(contrast(foreground,background) >= 4.5);
console.log(`PASS: 5 routes, ${assertions} long paragraphs matched, all experience bullets, exact NMIMS copy, qualified metrics, local links/assets, headings, reduced motion and text contrast.`);
console.log(`Initial JavaScript: ${gzipSync(js).length} bytes gzip. Minimum text contrast: ${Math.min(...pairs.map(p=>contrast(...p))).toFixed(2)}:1.`);
