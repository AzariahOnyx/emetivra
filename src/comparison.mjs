import { evaluate, words } from './retrieval.mjs';

const STRATEGIES = ['fixed', 'heading-aware'];
const METRICS = ['hitAtK', 'mrrAtK'];

/** Compare two Markdown corpora against exactly the same labeled queries and retrieval settings.
 * Scores describe lexical BM25 ranking against heading-derived relevance labels, NOT LLM quality.
 */
export function compareDocuments(baseline, candidate, queries, k = 3) {
  if (typeof baseline !== 'string' || !baseline.trim()) throw Error('Add baseline Markdown.');
  if (typeof candidate !== 'string' || !candidate.trim()) throw Error('Add candidate Markdown.');
  if (!Array.isArray(queries) || queries.length === 0) throw Error('Add labeled evaluation queries.');
  if (!Number.isInteger(k) || k < 1) throw Error('Invalid retrieval depth.');
  const strategies = {};
  for (const strategy of STRATEGIES) {
    // evaluate() validates that every heading label occurs exactly once in EACH corpus.
    const before = evaluate(baseline, queries, strategy, k);
    const after = evaluate(candidate, queries, strategy, k);
    const paired = before.results.map((b, i) => {
      const a = after.results[i];
      return {
        query: b.query, heading: b.heading,
        baseline: { hit: b.hit, reciprocalRank: b.reciprocalRank, top: b.top },
        candidate: { hit: a.hit, reciprocalRank: a.reciprocalRank, top: a.top },
        hitDelta: a.hit - b.hit,
        reciprocalRankDelta: a.reciprocalRank - b.reciprocalRank
      };
    });
    const beforeMetrics = { hitAtK: before.recallAtK, mrrAtK: before.mrrAtK, chunks: before.chunkCount };
    const afterMetrics = { hitAtK: after.recallAtK, mrrAtK: after.mrrAtK, chunks: after.chunkCount };
    strategies[strategy] = {
      baseline: beforeMetrics, candidate: afterMetrics,
      delta: Object.fromEntries(METRICS.map(m => [m, afterMetrics[m] - beforeMetrics[m]])),
      paired
    };
  }
  return {
    schemaVersion: '1.0',
    timestamp: new Date().toISOString(),
    config: { k, strategies: STRATEGIES, chunkSize: 70, overlap: 15, ranker: 'BM25', k1: 1.2, b: 0.75 },
    labels: queries.map(q => ({ query: q.query, heading: q.heading })),
    corpora: { baselineWords: words(baseline).length, candidateWords: words(candidate).length },
    strategies,
    limitations: [
      'Hit@K is binary hit rate, not multi-label recall.',
      'Relevance is derived from a uniquely matching Markdown heading in each corpus; it is not independently human-judged.',
      'Fixed-window relevance uses source word-offset overlap; heading-aware relevance uses section labels.',
      'Parent heading sections can include nested child sections and heading-aware chunks can duplicate text.',
      'BM25 is lexical retrieval; results do not measure embeddings, generated answers, factual grounding, or production RAG accuracy.',
      'Small or hand-picked query sets do not support claims of general improvement.'
    ]
  };
}

export function parseQueryLines(raw) {
  if (typeof raw !== 'string') throw Error('Queries must be JSON Lines.');
  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length) throw Error('Add at least one labeled query.');
  if (lines.length > 100) throw Error('Maximum 100 labeled queries per comparison.');
  return lines.map((line, i) => {
    let q;
    try { q = JSON.parse(line); } catch { throw Error(`Invalid JSON on query line ${i + 1}.`); }
    if (!q || typeof q.query !== 'string' || !q.query.trim() || typeof q.heading !== 'string' || !q.heading.trim()) {
      throw Error(`Query line ${i + 1} requires nonempty query and heading strings.`);
    }
    return { query: q.query.trim(), heading: q.heading.trim() };
  });
}

export function comparisonMarkdown(report) {
  const f = n => (n * 100).toFixed(1) + '%';
  const lines = [
    '# EMETIVRA — Before / After Retrieval Evaluation', '',
    `Generated: ${report.timestamp}`, '',
    '## Method', '',
    `Same ${report.labels.length} labeled questions, BM25 (k1=${report.config.k1}, b=${report.config.b}), chunk size ${report.config.chunkSize}, overlap ${report.config.overlap}, K=${report.config.k}.`,
    `Baseline: ${report.corpora.baselineWords} words; candidate: ${report.corpora.candidateWords} words.`, '',
    '## Aggregate results', '',
    '| Strategy | Metric | Baseline | Candidate | Delta (percentage points) |',
    '| --- | --- | ---: | ---: | ---: |'
  ];
  for (const [name, s] of Object.entries(report.strategies)) {
    for (const metric of ['hitAtK', 'mrrAtK']) {
      lines.push(`| ${name} | ${metric} | ${f(s.baseline[metric])} | ${f(s.candidate[metric])} | ${(s.delta[metric] * 100).toFixed(1)} |`);
    }
  }
  lines.push('', '## Per-query evidence', '');
  for (const [name, s] of Object.entries(report.strategies)) {
    lines.push(`### ${name}`, '');
    for (const q of s.paired) {
      lines.push(`- **${q.query.replace(/[\r\n]/g, ' ')}** (heading: ${q.heading.replace(/[\r\n]/g, ' ')}) — hit ${q.baseline.hit} → ${q.candidate.hit}; reciprocal rank ${q.baseline.reciprocalRank.toFixed(3)} → ${q.candidate.reciprocalRank.toFixed(3)}.`);
    }
    lines.push('');
  }
  lines.push('## Limitations', '', ...report.limitations.map(s => '- ' + s), '');
  return lines.join('\n');
}

export function comparisonCSV(report) {
  const quote = x => '"' + String(x ?? '').replace(/"/g, '""') + '"';
  const rows = [['strategy', 'query', 'heading', 'baseline_hit', 'candidate_hit', 'hit_delta', 'baseline_rr', 'candidate_rr', 'rr_delta']];
  for (const [strategy, data] of Object.entries(report.strategies)) {
    for (const q of data.paired) rows.push([strategy, q.query, q.heading, q.baseline.hit, q.candidate.hit, q.hitDelta, q.baseline.reciprocalRank, q.candidate.reciprocalRank, q.reciprocalRankDelta]);
  }
  return rows.map(row => row.map(quote).join(',')).join('\r\n');
}