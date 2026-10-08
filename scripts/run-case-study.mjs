import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { annotationTemplate, evaluateJudged, judgedCSV, judgedMarkdown, STRATEGIES } from '../src/judged.mjs';

const base = resolve(dirname(fileURLToPath(import.meta.url)), '../benchmarks/v1.1');
const source = readFileSync(resolve(base, 'corpus.md'), 'utf8');
const questions = JSON.parse(readFileSync(resolve(base, 'questions.json'), 'utf8'));

export function buildIllustrativeDataset(sourceText, questionsList) {
  const dataset = annotationTemplate(sourceText, questionsList);
  dataset.annotationStatus = 'judged';
  dataset.annotator = 'EMETIVRA project author — rule-derived demo, NOT independent human review';
  dataset.annotationDate = '2026-10-08';
  dataset.labelMethod = 'mechanical answer-phrase containment in chunk text';
  for (let i = 0; i < questionsList.length; i++) {
    const q = questionsList[i];
    if (typeof q.answerPhrase !== 'string' || q.answerPhrase.length < 8) throw Error('Missing answer phrase for ' + q.id);
    if (!sourceText.includes(q.answerPhrase)) throw Error('Answer phrase not found in corpus for ' + q.id);
    dataset.queries[i].id = q.id;
    for (const strategy of STRATEGIES) {
      const relevant = dataset.chunks[strategy].filter(c => c.excerpt.includes(q.answerPhrase)).map(c => c.id);
      if (!relevant.length) throw Error('Answer phrase is not contained in a ' + strategy + ' chunk for ' + q.id);
      dataset.queries[i].relevant[strategy] = relevant;
    }
  }
  return dataset;
}

export function buildReport(sourceText, questionsList) {
  const dataset = buildIllustrativeDataset(sourceText, questionsList);
  const result = evaluateJudged(sourceText, dataset);
  result.type = 'synthetic-answer-span-evaluation';
  result.provenance.labelType = 'deterministic answer-phrase containment; developer-authored synthetic questions; NOT independent human judgments';
  result.provenance.labelMethod = dataset.labelMethod;
  result.provenance.datasetKind = 'illustrative synthetic; not representative of production workloads';
  result.provenance.questionCount = questionsList.length;
  result.limitations.unshift('This is a developer-authored, rule-labeled synthetic benchmark; no independent human relevance judgments were collected.');
  result.limitations.unshift('Phrase containment measures lexical answer-span presence, not complete semantic relevance or answer correctness.');
  return { dataset, report: result };
}

function fmt(n) { return (n * 100).toFixed(1) + '%'; }
export function caseStudyMarkdown(report) {
  const lines = [
    '# EMETIVRA — Reproducible Synthetic Retrieval Case Study', '',
    '**Status:** Illustrative developer-authored benchmark; **not independently judged** or representative.', '',
    '## Research question', '',
    'On a controlled fictional operations guide, how do fixed-window and heading-aware chunking perform under identical lexical BM25 settings and a rule-derived answer-span relevance policy?', '',
    '## Corpus and questions', '',
    `- ${report.provenance.queryCount} developer-authored queries; fictional Markdown operations guide.`,
    '- Each query has a known answer phrase. A chunk is labeled relevant when its first 500 characters contain that exact phrase.',
    '- The same questions are used for both strategies. Chunk sets differ, so labels are strategy-specific.',
    `- Source fingerprint: \`${report.provenance.corpusFingerprint}\`.`,
    '- Source: `benchmarks/v1.1/corpus.md`; questions: `benchmarks/v1.1/questions.json`.', '',
    '## Reproduce', '', '```bash', 'npm install --ignore-scripts  # no external dependencies required', 'npm run benchmark:case-study', 'npm test', '```', '',
    '## Results', '',
    '| Strategy | Chunks | P@3 | Recall@3 | Hit@3 | MRR@3 | nDCG@3 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];
  for (const [name, s] of Object.entries(report.strategies)) {
    const m = s.metrics;
    lines.push(`| ${name} | ${s.chunkCount} | ${fmt(m.precisionAtK)} | ${fmt(m.recallAtK)} | ${fmt(m.hitAtK)} | ${fmt(m.reciprocalRankAtK)} | ${fmt(m.ndcgAtK)} |`);
  }
  lines.push('', '## Method', '',
    '- Fixed chunks: 70 whitespace-delimited words, 15-word overlap; heading-aware chunks use the same window settings within Markdown sections.',
    '- Ranking: BM25 k1=1.2, b=0.75; K=3. Metrics are macro-averaged across queries.',
    '- Ground truth: exact answer-phrase containment in the first 500 characters of a chunk (a documented **proxy**, not human annotation).',
    '- Dataset and report are generated from the committed source and questions; no remote APIs or LLM calls.', '',
    '## Threats to validity', '',
    '- Fictional single-document corpus and only 12 author-written questions; findings cannot be generalized.',
    '- Answer phrases were selected with knowledge of the source; no blinded annotator or inter-annotator agreement.',
    '- Exact phrase containment misses paraphrases and can label a snippet relevant even when context is inadequate.',
    '- Heading-aware chunking may duplicate parent-section text, altering ranking statistics.',
    '- Lexical BM25 does not measure embedding retrieval, generated answer correctness, or grounding.',
    '- Precision@3 divides by three even if a strategy has fewer available chunks.', '',
    '## Next validation step', '',
    'Recruit at least two independent reviewers to judge full chunk relevance for real permission-cleared documentation and naturally occurring queries. Pre-register inclusion criteria, adjudicate disagreements, and report confidence intervals before claiming production improvement.', '',
    '## Per-query evidence', '');
  for (const [strategy, data] of Object.entries(report.strategies)) {
    lines.push(`### ${strategy}`, '');
    for (const q of data.results) lines.push(`- **${q.id}** (${q.query}): top ${q.top.map(c=>c.id+(c.relevant?' ✓':' ×')).join(', ')}; Recall@3 ${fmt(q.recallAtK)}, RR@3 ${fmt(q.reciprocalRankAtK)}.`);
    lines.push('');
  }
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {dataset,report} = buildReport(source,questions);
  // Stable committed artifacts: exclude volatile timestamp from generated report.
  report.evaluatedAt = '2026-10-08T00:00:00.000Z';
  writeFileSync(resolve(base,'labels.json'),JSON.stringify(dataset,null,2)+'\n');
  writeFileSync(resolve(base,'report.json'),JSON.stringify(report,null,2)+'\n');
  writeFileSync(resolve(base,'report.csv'),judgedCSV(report)+'\n');
  writeFileSync(resolve(base,'CASE_STUDY.md'),caseStudyMarkdown(report)+'\n');
  process.stdout.write('Synthetic case study: '+questions.length+' queries\n');
  for(const [strategy,s] of Object.entries(report.strategies))process.stdout.write(strategy+': P@3 '+fmt(s.metrics.precisionAtK)+' Recall@3 '+fmt(s.metrics.recallAtK)+' Hit@3 '+fmt(s.metrics.hitAtK)+' MRR@3 '+fmt(s.metrics.reciprocalRankAtK)+' nDCG@3 '+fmt(s.metrics.ndcgAtK)+'\n');
}
