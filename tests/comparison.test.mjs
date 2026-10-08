import test from 'node:test';
import assert from 'node:assert/strict';
import { compareDocuments, parseQueryLines, comparisonMarkdown, comparisonCSV } from '../src/comparison.mjs';
const before = '# Guide\n\n## Apples\n\nApples are red.\n\n## Bananas\n\nBananas are yellow.';
const after = '# Guide\n\n## Apples\n\nApples are red.\n\n## Bananas\n\nBananas are yellow and ripe.';
const labels = [{ query: 'yellow bananas', heading: 'Bananas' }];

test('identical corpora yield exactly zero paired metric deltas', () => {
  const r = compareDocuments(before, before, labels);
  for (const s of Object.values(r.strategies)) {
    assert.equal(s.delta.hitAtK, 0);
    assert.equal(s.delta.mrrAtK, 0);
    assert.equal(s.paired[0].hitDelta, 0);
    assert.equal(s.paired[0].reciprocalRankDelta, 0);
  }
});
test('reports both retrieval strategies with same query set and settings', () => {
  const r = compareDocuments(before, after, labels);
  assert.deepEqual(Object.keys(r.strategies), ['fixed', 'heading-aware']);
  assert.equal(r.config.k, 3);
  assert.equal(r.labels.length, 1);
  for (const s of Object.values(r.strategies)) {
    assert.equal(s.paired.length, 1);
    assert.equal(s.delta.hitAtK, s.candidate.hitAtK - s.baseline.hitAtK);
    assert.equal(s.delta.mrrAtK, s.candidate.mrrAtK - s.baseline.mrrAtK);
  }
});
test('rejects heading labels absent from candidate corpus', () => {
  assert.throws(() => compareDocuments(before, '# Guide\n\n## Apples\n\nNo banana heading.', labels), /Heading label/);
});
test('rejects ambiguous heading labels in baseline', () => {
  assert.throws(() => compareDocuments(before + '\n\n## Bananas\n\nDuplicate.', after, labels), /Heading label/);
});
test('rejects empty corpora, invalid depth, and empty queries', () => {
  assert.throws(() => compareDocuments('', after, labels), /baseline/i);
  assert.throws(() => compareDocuments(before, '', labels), /candidate/i);
  assert.throws(() => compareDocuments(before, after, []), /queries/i);
  assert.throws(() => compareDocuments(before, after, labels, 0), /depth/i);
});
test('parses JSON Lines and reports line numbers on malformed JSON', () => {
  assert.deepEqual(parseQueryLines(' {"query":"yellow bananas","heading":"Bananas"} \n'), labels);
  assert.throws(() => parseQueryLines('{}\nnot-json'), /line 1/);
  assert.throws(() => parseQueryLines(JSON.stringify(labels[0]) + '\nnot-json'), /line 2/);
  assert.throws(() => parseQueryLines(''), /at least one/);
});
test('Markdown export contains aggregate and query-level results and limitations', () => {
  const text = comparisonMarkdown(compareDocuments(before, after, labels));
  assert.match(text, /Aggregate results/);
  assert.match(text, /yellow bananas/);
  assert.match(text, /Limitations/);
  assert.match(text, /percentage points/);
});
test('CSV exports paired rows and correctly escapes commas and quotes', () => {
  const r = compareDocuments(before, after, [{ query: 'yellow, "bananas"', heading: 'Bananas' }]);
  const csv = comparisonCSV(r);
  assert.match(csv, /"yellow, ""bananas"""/);
  assert.equal(csv.split('\r\n').length, 3);
});

test('UI exposes before/after comparison without remote services', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(html, /data-tab="compare"/);
  assert.match(app, /comparisonPanel\.render\(p\)/);
});