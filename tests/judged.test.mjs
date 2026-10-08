import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceFingerprint, chunkCatalog, annotationTemplate, validateJudgments, evaluateJudged, judgedMarkdown, judgedCSV } from '../src/judged.mjs';

const corpus = '# Token API\n\n## Generate\n\nUse client credentials to generate a token.\n\n## Refresh\n\nUse a refresh token to renew access.\n\n## Revoke\n\nInvalidate tokens by calling revoke.';
const template = () => annotationTemplate(corpus, [{query:'generate a token'}, {query:'refresh token'}]);
function judged() {
  const t = template();
  t.annotationStatus = 'judged';
  t.annotator = 'reviewer-1';
  t.annotationDate = '2026-10-08';
  for (const q of t.queries) for (const strategy of ['fixed','heading-aware']) q.relevant[strategy] = [t.chunks[strategy][0].id];
  return t;
}

test('fingerprint is deterministic and changes with corpus', () => {
  assert.equal(sourceFingerprint(corpus), sourceFingerprint(corpus));
  assert.notEqual(sourceFingerprint(corpus), sourceFingerprint(corpus+' '));
});
test('template never fabricates relevance labels', () => {
  const t = template();
  assert.equal(t.annotationStatus,'unjudged');
  assert.equal(t.queries[0].relevant.fixed.length,0);
  assert.equal(t.queries[0].relevant['heading-aware'].length,0);
  assert.equal(t.queries[1].id,'q2');
});
test('chunk IDs are stable and strategy-specific', () => {
  const c=chunkCatalog(corpus);
  assert.equal(c.fixed[0].id,'fixed:0');
  assert.equal(c['heading-aware'][0].id,'heading-aware:0');
  assert.ok(c['heading-aware'].length>0);
});
test('unjudged data cannot be evaluated', () => assert.throws(()=>evaluateJudged(corpus,template()),/annotationStatus/));
test('dataset cannot be applied to a changed source', () => assert.throws(()=>evaluateJudged(corpus+' changed',judged()),/fingerprint/));
test('unknown chunk IDs are rejected', () => { const t=judged();t.queries[0].relevant.fixed=['fixed:999'];assert.throws(()=>evaluateJudged(corpus,t),/Unknown relevant chunk/); });
test('duplicate relevance IDs are rejected', () => { const t=judged();t.queries[0].relevant.fixed=['fixed:0','fixed:0'];assert.throws(()=>evaluateJudged(corpus,t),/unique/); });
test('empty relevance judgments are rejected', () => { const t=judged();t.queries[0].relevant.fixed=[];assert.throws(()=>evaluateJudged(corpus,t),/no relevant/); });
test('altered catalog is rejected', () => { const t=judged();t.chunks.fixed[0].excerpt='tampered';assert.throws(()=>evaluateJudged(corpus,t),/catalog/); });
test('altered settings are rejected', () => { const t=judged();t.config={...t.config,k:1};assert.throws(()=>evaluateJudged(corpus,t),/settings/); });
test('duplicate query IDs are rejected', () => { const t=judged();t.queries[1].id='q1';assert.throws(()=>evaluateJudged(corpus,t),/Query IDs/); });
test('requires annotator provenance', () => { const t=judged();t.annotator='';assert.throws(()=>evaluateJudged(corpus,t),/annotator/); });
test('requires annotation date', () => { const t=judged();t.annotationDate='';assert.throws(()=>evaluateJudged(corpus,t),/annotationDate/); });
test('perfect top-ranked judgment has expected metrics', () => {
  const t=judged();
  // Only one fixed chunk exists; its rank is always 1. Precision denominator remains K=3.
  const r=evaluateJudged(corpus,t), m=r.strategies.fixed.metrics;
  assert.equal(m.precisionAtK,1/3);
  assert.equal(m.recallAtK,1);
  assert.equal(m.hitAtK,1);
  assert.equal(m.reciprocalRankAtK,1);
  assert.equal(m.ndcgAtK,1);
  assert.equal(r.provenance.labelType.includes('not independently verified'),true);
});
test('rank metrics support non-relevant top hits and multi-label recall', () => {
  const t=judged();
  t.queries=[{id:'q1',query:'generate a token',relevant:{fixed:['fixed:0'],'heading-aware':[t.chunks['heading-aware'].at(-1).id]}}];
  const r=evaluateJudged(corpus,t).strategies['heading-aware'].results[0];
  assert.ok(r.recallAtK>=0 && r.recallAtK<=1);
  assert.ok(r.ndcgAtK>=0 && r.ndcgAtK<=1);
  assert.ok(r.precisionAtK>=0 && r.precisionAtK<=1);
});
test('exports contain methodology and query evidence', () => {
  const r=evaluateJudged(corpus,judged());
  assert.match(judgedMarkdown(r),/nDCG@3/);
  assert.match(judgedMarkdown(r),/No verification/i);
  assert.match(judgedCSV(r),/precision_at_k/);
  assert.match(judgedCSV(r),/heading-aware/);
});
test('invalid JSON input shape and missing source rejected', () => {
  assert.throws(()=>validateJudgments(corpus,null),/JSON object/);
  assert.throws(()=>chunkCatalog(''),/Add a Markdown/);
});