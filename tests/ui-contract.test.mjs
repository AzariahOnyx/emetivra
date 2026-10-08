import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

test('entrypoint declares accessible language and document title', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<textarea[^>]*aria-label=/);
});
test('static assets are linked to repository source', () => {
  assert.match(html, /href="\/src\/style\.css"/);
  assert.match(html, /src="\/src\/app\.mjs"/);
});
test('required application controls exist in the HTML', () => {
  for (const id of ['doc','file','auditBtn','resetBtn','panel','score','gauge','toast']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});
test('app imports the shared retrieval engine', () => {
  assert.match(app, /from ['"]\.\/retrieval\.mjs['"]/);
});
test('responsive styles and reduced-motion support exist', () => {
  assert.match(css, /@media/);
  assert.match(css, /prefers-reduced-motion/);
});
