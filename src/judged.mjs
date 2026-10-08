import { chunk, bm25 } from './retrieval.mjs';

export const STRATEGIES = ['fixed', 'heading-aware'];
export const SETTINGS = Object.freeze({ k: 3, chunkSize: 70, overlap: 15, ranker: 'BM25', k1: 1.2, b: 0.75 });

// Non-cryptographic source fingerprint: guards accidental dataset/corpus mismatch, not malicious tampering.
export function sourceFingerprint(source) {
  if (typeof source !== 'string') throw Error('Source must be text.');
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return 'fnv1a32:' + (hash >>> 0).toString(16).padStart(8, '0') + ':' + source.length;
}

export function chunkCatalog(source) {
  if (typeof source !== 'string' || !source.trim()) throw Error('Add a Markdown source document.');
  return Object.fromEntries(STRATEGIES.map(strategy => [strategy, chunk(source, strategy, SETTINGS.chunkSize, SETTINGS.overlap)
    .map((c, index) => ({ id: strategy + ':' + index, index, start: c.start, end: c.end, section: c.section ?? null, excerpt: c.text.slice(0, 500) }))]));
}

export function annotationTemplate(source, questions = []) {
  const chunks = chunkCatalog(source);
  if (!Array.isArray(questions)) throw Error('Questions must be an array.');
  return {
    schemaVersion: '1.0',
    corpusFingerprint: sourceFingerprint(source),
    annotationStatus: 'unjudged',
    annotator: '',
    annotationDate: '',
    instructions: 'Manually inspect the source and chunk catalog. Enter ALL relevant chunk IDs for each query under each strategy. Do not treat empty arrays as negative judgments; evaluation requires at least one relevant chunk for each query and strategy.',
    config: SETTINGS,
    chunks,
    queries: questions.map((q, i) => ({ id: 'q' + (i + 1), query: String(q.query ?? '').trim(), relevant: { fixed: [], 'heading-aware': [] } }))
  };
}

function assertUniqueStrings(values, name) {
  if (!Array.isArray(values) || values.some(x => typeof x !== 'string' || !x.trim()) || new Set(values).size !== values.length) throw Error(name + ' must contain unique nonempty strings.');
}

export function validateJudgments(source, dataset) {
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) throw Error('Dataset must be a JSON object.');
  if (dataset.schemaVersion !== '1.0') throw Error('Unsupported judgment schema version.');
  if (dataset.corpusFingerprint !== sourceFingerprint(source)) throw Error('Dataset source fingerprint does not match the current document. Regenerate annotations.');
  if (dataset.annotationStatus !== 'judged') throw Error('Set annotationStatus to "judged" only after completing independent manual judgments.');
  if (typeof dataset.annotator !== 'string' || !dataset.annotator.trim()) throw Error('Enter an annotator identifier.');
  if (typeof dataset.annotationDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dataset.annotationDate) || Number.isNaN(Date.parse(dataset.annotationDate))) throw Error('Enter annotationDate as YYYY-MM-DD.');
  if (!dataset.config || JSON.stringify(dataset.config) !== JSON.stringify(SETTINGS)) throw Error('Retrieval settings differ from the supported benchmark configuration.');
  const catalog = chunkCatalog(source);
  if (!dataset.chunks || JSON.stringify(dataset.chunks) !== JSON.stringify(catalog)) throw Error('Chunk catalog differs from the current source. Regenerate annotations.');
  if (!Array.isArray(dataset.queries) || dataset.queries.length < 1 || dataset.queries.length > 100) throw Error('Provide 1–100 judged queries.');
  assertUniqueStrings(dataset.queries.map(q => q?.id), 'Query IDs');
  for (const q of dataset.queries) {
    if (typeof q.query !== 'string' || !q.query.trim()) throw Error('Each query requires nonempty text.');
    for (const strategy of STRATEGIES) {
      const ids = q.relevant?.[strategy];
      assertUniqueStrings(ids, 'Relevance IDs for ' + q.id + ' / ' + strategy);
      if (!ids.length) throw Error('Query ' + q.id + ' has no relevant ' + strategy + ' chunks. Add manual judgments or omit the query.');
      const allowed = new Set(catalog[strategy].map(c => c.id));
      for (const id of ids) if (!allowed.has(id)) throw Error('Unknown relevant chunk ' + id + ' for ' + q.id);
    }
  }
  return catalog;
}

function evaluateRanking(ranked, relevant, k) {
  const top = ranked.slice(0, k).map((c, i) => ({ id: c.id, rank: i + 1, relevant: relevant.has(c.id), score: c.score, excerpt: c.text.slice(0, 350) }));
  const hits = top.filter(c => c.relevant);
  const dcg = top.reduce((n, c) => n + (c.relevant ? 1 / Math.log2(c.rank + 1) : 0), 0);
  const ideal = Array.from({ length: Math.min(k, relevant.size) }, (_, i) => 1 / Math.log2(i + 2)).reduce((a, b) => a + b, 0);
  return { precisionAtK: hits.length / k, recallAtK: hits.length / relevant.size, hitAtK: Number(hits.length > 0), reciprocalRankAtK: hits.length ? 1 / hits[0].rank : 0, ndcgAtK: ideal ? dcg / ideal : 0, relevantCount: relevant.size, top };
}

export function evaluateJudged(source, dataset) {
  const catalog = validateJudgments(source, dataset);
  const k = SETTINGS.k;
  const strategies = {};
  for (const strategy of STRATEGIES) {
    const cs = chunk(source, strategy, SETTINGS.chunkSize, SETTINGS.overlap).map((c, i) => ({ ...c, id: strategy + ':' + i }));
    const results = dataset.queries.map(q => ({ id: q.id, query: q.query, ...evaluateRanking(bm25(cs, q.query, SETTINGS.k1, SETTINGS.b), new Set(q.relevant[strategy]), k) }));
    const metrics = ['precisionAtK', 'recallAtK', 'hitAtK', 'reciprocalRankAtK', 'ndcgAtK'];
    strategies[strategy] = { chunkCount: catalog[strategy].length, metrics: Object.fromEntries(metrics.map(m => [m, results.reduce((sum, r) => sum + r[m], 0) / results.length])), results };
  }
  return {
    schemaVersion: '1.0', type: 'manual-relevance-evaluation', evaluatedAt: new Date().toISOString(),
    provenance: { annotator: dataset.annotator.trim(), annotationDate: dataset.annotationDate, corpusFingerprint: dataset.corpusFingerprint, queryCount: dataset.queries.length, labelType: 'user-supplied manual chunk judgments (not independently verified)' },
    config: SETTINGS, strategies,
    limitations: [
      'Judgments are supplied by the evaluator and cannot be independently verified by this app.',
      'Chunk relevance depends on the strategy; rankings are not directly comparable without consistent annotation criteria.',
      'Precision@K divides by K even when fewer than K chunks exist; recall divides by all manually relevant chunks.',
      'Unjudged chunks are treated as nonrelevant; incomplete relevance annotation biases the metrics.',
      'A small or cherry-picked query set is not representative; report dataset selection and annotation procedure.',
      'BM25 is lexical only. No embedding retrieval, LLM generation, or answer grounding is measured.'
    ]
  };
}

export function judgedMarkdown(report) {
  const lines = ['# EMETIVRA — Manually Judged Retrieval Evaluation', '', 'Generated: ' + report.evaluatedAt, '',
    'Annotator: ' + report.provenance.annotator, 'Annotation date: ' + report.provenance.annotationDate,
    'Corpus fingerprint: ' + report.provenance.corpusFingerprint, 'Queries: ' + report.provenance.queryCount,
    '', '## Method', '', 'BM25; K=' + report.config.k + '; chunk size=' + report.config.chunkSize + '; overlap=' + report.config.overlap + '.',
    'User-supplied manual relevance judgments. No verification of annotator independence.', '', '## Metrics', '',
    '| Strategy | P@3 | Recall@3 | Hit@3 | MRR@3 | nDCG@3 |', '| --- | ---: | ---: | ---: | ---: | ---: |'];
  for (const [strategy, data] of Object.entries(report.strategies)) {
    const m = data.metrics;
    lines.push('| ' + strategy + ' | ' + [m.precisionAtK,m.recallAtK,m.hitAtK,m.reciprocalRankAtK,m.ndcgAtK].map(v => (100 * v).toFixed(1) + '%').join(' | ') + ' |');
  }
  lines.push('', '## Query-level evidence', '');
  for (const [strategy, data] of Object.entries(report.strategies)) {
    lines.push('### ' + strategy, '');
    for (const q of data.results) lines.push('- ' + q.id + ': ' + q.query.replace(/[\r\n]/g, ' ') + ' — relevant ' + q.relevantCount + ', P@3 ' + q.precisionAtK.toFixed(3) + ', Recall@3 ' + q.recallAtK.toFixed(3) + ', RR@3 ' + q.reciprocalRankAtK.toFixed(3) + ', nDCG@3 ' + q.ndcgAtK.toFixed(3) + '. Top: ' + q.top.map(c => c.id + (c.relevant ? ' ✓' : ' ×')).join(', '));
    lines.push('');
  }
  lines.push('## Limitations', '', ...report.limitations.map(s => '- ' + s), '');
  return lines.join('\n');
}

export function judgedCSV(report) {
  const quote = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const rows = [['strategy','query_id','query','relevant_count','precision_at_k','recall_at_k','hit_at_k','reciprocal_rank_at_k','ndcg_at_k','ranked_chunk_ids']];
  for (const [strategy, data] of Object.entries(report.strategies)) for (const q of data.results)
    rows.push([strategy,q.id,q.query,q.relevantCount,q.precisionAtK,q.recallAtK,q.hitAtK,q.reciprocalRankAtK,q.ndcgAtK,q.top.map(c => c.id).join(';')]);
  return rows.map(row => row.map(quote).join(',')).join('\r\n');
}