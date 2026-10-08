import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIllustrativeDataset, buildReport, caseStudyMarkdown } from '../scripts/run-case-study.mjs';
import { caseStudyHtml } from '../src/case-study-ui.mjs';
import { evaluateJudged, sourceFingerprint } from '../src/judged.mjs';

const read = name => readFileSync(new URL('../benchmarks/v1.1/' + name, import.meta.url), 'utf8');
const source = read('corpus.md');
const questions = JSON.parse(read('questions.json'));
const {dataset,report} = buildReport(source,questions);

test('synthetic corpus and queries are explicit and diverse', () => {
  assert.equal(questions.length,12);
  assert.equal(new Set(questions.map(q=>q.id)).size,12);
  assert.equal(new Set(questions.map(q=>q.topic)).size,12);
  assert.match(source,/fictional/i);
});
test('labels are tied to the exact source and a disclosed answer phrase rule', () => {
  assert.equal(dataset.corpusFingerprint,sourceFingerprint(source));
  assert.match(dataset.labelMethod,/mechanical/);
  for(const q of dataset.queries)for(const strategy of ['fixed','heading-aware'])assert.ok(q.relevant[strategy].length);
});
test('every label contains its query answer phrase in the catalog excerpt', () => {
  for(let i=0;i<questions.length;i++)for(const strategy of ['fixed','heading-aware']){
    const selected=dataset.chunks[strategy].filter(c=>dataset.queries[i].relevant[strategy].includes(c.id));
    assert.ok(selected.every(c=>c.excerpt.includes(questions[i].answerPhrase)));
  }
});
test('all matching excerpt chunks are labeled, not just top-ranked ones', () => {
  for(let i=0;i<questions.length;i++)for(const strategy of ['fixed','heading-aware']){
    const all=dataset.chunks[strategy].filter(c=>c.excerpt.includes(questions[i].answerPhrase)).map(c=>c.id);
    assert.deepEqual(dataset.queries[i].relevant[strategy],all);
  }
});
test('reported metrics match a fresh evaluation', () => {
  const fresh=evaluateJudged(source,dataset);
  for(const strategy of ['fixed','heading-aware'])assert.deepEqual(report.strategies[strategy].metrics,fresh.strategies[strategy].metrics);
});
test('report discloses synthetic labels rather than independent judgments', () => {
  assert.equal(report.type,'synthetic-answer-span-evaluation');
  assert.match(report.provenance.labelType,/NOT independent/);
  assert.match(caseStudyMarkdown(report),/not independently judged/i);
});
test('committed outputs are reproducible byte-for-byte except generated time', () => {
  const stored=JSON.parse(read('report.json'));
  const fresh=structuredClone(report);
  fresh.evaluatedAt=stored.evaluatedAt;
  assert.deepEqual(fresh,stored);
  assert.deepEqual(JSON.parse(read('labels.json')),dataset);
  assert.equal(read('CASE_STUDY.md'),caseStudyMarkdown(report)+'\n');
});
test('case study UI escapes author-controlled query strings', () => {
  const modified=structuredClone(report);
  modified.strategies.fixed.results[0].query='<img src=x onerror=alert(1)>';
  const html=caseStudyHtml(modified);
  assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/&lt;img/);
  assert.match(html,/not independent human judgments/i);
});
test('case study UI rejects unexpected report format',()=>assert.throws(()=>caseStudyHtml({type:'unknown'}),/Unexpected/));
test('missing answer phrase fails closed',()=>assert.throws(()=>buildIllustrativeDataset(source,[{id:'bad',query:'bad',answerPhrase:'absent phrase not in document'}]),/not found/));