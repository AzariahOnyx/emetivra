# EMETIVRA — Reproducible Synthetic Retrieval Case Study

**Status:** Illustrative developer-authored benchmark; **not independently judged** or representative.

## Research question

On a controlled fictional operations guide, how do fixed-window and heading-aware chunking perform under identical lexical BM25 settings and a rule-derived answer-span relevance policy?

## Corpus and questions

- 12 developer-authored queries; fictional Markdown operations guide.
- Each query has a known answer phrase. A chunk is labeled relevant when its first 500 characters contain that exact phrase.
- The same questions are used for both strategies. Chunk sets differ, so labels are strategy-specific.
- Source fingerprint: `fnv1a32:0b8cb02b:7113`.
- Source: `benchmarks/v1.1/corpus.md`; questions: `benchmarks/v1.1/questions.json`.

## Reproduce

```bash
npm install --ignore-scripts  # no external dependencies required
npm run benchmark:case-study
npm test
```

## Results

| Strategy | Chunks | P@3 | Recall@3 | Hit@3 | MRR@3 | nDCG@3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fixed | 19 | 25.0% | 75.0% | 75.0% | 75.0% | 75.0% |
| heading-aware | 43 | 50.0% | 75.0% | 83.3% | 79.2% | 73.7% |

## Method

- Fixed chunks: 70 whitespace-delimited words, 15-word overlap; heading-aware chunks use the same window settings within Markdown sections.
- Ranking: BM25 k1=1.2, b=0.75; K=3. Metrics are macro-averaged across queries.
- Ground truth: exact answer-phrase containment in the first 500 characters of a chunk (a documented **proxy**, not human annotation).
- Dataset and report are generated from the committed source and questions; no remote APIs or LLM calls.

## Threats to validity

- Fictional single-document corpus and only 12 author-written questions; findings cannot be generalized.
- Answer phrases were selected with knowledge of the source; no blinded annotator or inter-annotator agreement.
- Exact phrase containment misses paraphrases and can label a snippet relevant even when context is inadequate.
- Heading-aware chunking may duplicate parent-section text, altering ranking statistics.
- Lexical BM25 does not measure embedding retrieval, generated answer correctness, or grounding.
- Precision@3 divides by three even if a strategy has fewer available chunks.

## Next validation step

Recruit at least two independent reviewers to judge full chunk relevance for real permission-cleared documentation and naturally occurring queries. Pre-register inclusion criteria, adjudicate disagreements, and report confidence intervals before claiming production improvement.

## Per-query evidence

### fixed

- **q01** (where to make a new credential): top fixed:3 ×, fixed:2 ×, fixed:12 ×; Recall@3 0.0%, RR@3 0.0%.
- **q02** (what is the grace period for replacing secrets): top fixed:1 ×, fixed:0 ×, fixed:16 ×; Recall@3 0.0%, RR@3 0.0%.
- **q03** (how long does password reset link work): top fixed:4 ✓, fixed:5 ×, fixed:6 ×; Recall@3 100.0%, RR@3 100.0%.
- **q04** (how to enroll a second factor): top fixed:5 ✓, fixed:16 ×, fixed:4 ×; Recall@3 100.0%, RR@3 100.0%.
- **q05** (verify a newly released article is visible): top fixed:7 ✓, fixed:6 ×, fixed:8 ×; Recall@3 100.0%, RR@3 100.0%.
- **q06** (undo a bad production deployment): top fixed:8 ✓, fixed:13 ×, fixed:3 ×; Recall@3 100.0%, RR@3 100.0%.
- **q07** (what to do after too many API requests): top fixed:10 ✓, fixed:3 ×, fixed:12 ×; Recall@3 100.0%, RR@3 100.0%.
- **q08** (why integration callbacks are not delivered): top fixed:14 ×, fixed:13 ×, fixed:0 ×; Recall@3 0.0%, RR@3 0.0%.
- **q09** (how to recover data from snapshot): top fixed:13 ✓, fixed:12 ×, fixed:18 ×; Recall@3 100.0%, RR@3 100.0%.
- **q10** (download security events for an investigation): top fixed:14 ✓, fixed:5 ×, fixed:6 ×; Recall@3 100.0%, RR@3 100.0%.
- **q11** (load balancer readiness endpoint interval): top fixed:16 ✓, fixed:17 ×, fixed:7 ×; Recall@3 100.0%, RR@3 100.0%.
- **q12** (automatically email weekly usage summary): top fixed:17 ✓, fixed:10 ×, fixed:4 ×; Recall@3 100.0%, RR@3 100.0%.

### heading-aware

- **q01** (where to make a new credential): top heading-aware:3 ×, heading-aware:22 ×, heading-aware:34 ×; Recall@3 0.0%, RR@3 0.0%.
- **q02** (what is the grace period for replacing secrets): top heading-aware:19 ×, heading-aware:1 ×, heading-aware:40 ×; Recall@3 0.0%, RR@3 0.0%.
- **q03** (how long does password reset link work): top heading-aware:4 ✓, heading-aware:24 ×, heading-aware:23 ✓; Recall@3 100.0%, RR@3 100.0%.
- **q04** (how to enroll a second factor): top heading-aware:5 ✓, heading-aware:25 ✓, heading-aware:24 ×; Recall@3 100.0%, RR@3 100.0%.
- **q05** (verify a newly released article is visible): top heading-aware:7 ✓, heading-aware:28 ×, heading-aware:27 ✓; Recall@3 100.0%, RR@3 100.0%.
- **q06** (undo a bad production deployment): top heading-aware:29 ✓, heading-aware:8 ✓, heading-aware:22 ×; Recall@3 100.0%, RR@3 100.0%.
- **q07** (what to do after too many API requests): top heading-aware:10 ✓, heading-aware:21 ×, heading-aware:34 ×; Recall@3 50.0%, RR@3 100.0%.
- **q08** (why integration callbacks are not delivered): top heading-aware:32 ×, heading-aware:34 ✓, heading-aware:36 ×; Recall@3 50.0%, RR@3 50.0%.
- **q09** (how to recover data from snapshot): top heading-aware:35 ✓, heading-aware:13 ✓, heading-aware:12 ×; Recall@3 100.0%, RR@3 100.0%.
- **q10** (download security events for an investigation): top heading-aware:37 ✓, heading-aware:14 ✓, heading-aware:25 ×; Recall@3 100.0%, RR@3 100.0%.
- **q11** (load balancer readiness endpoint interval): top heading-aware:39 ✓, heading-aware:16 ✓, heading-aware:40 ×; Recall@3 100.0%, RR@3 100.0%.
- **q12** (automatically email weekly usage summary): top heading-aware:41 ✓, heading-aware:17 ✓, heading-aware:10 ×; Recall@3 100.0%, RR@3 100.0%.
