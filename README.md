# EMETIVRA — Knowledge Intelligence Studio

Local-first Markdown documentation auditing and reproducible keyword-retrieval benchmarking.

## Features

- Modern responsive UI with reduced-motion accessibility support.
- Markdown upload and document audit with evidence-linked recommendations.
- Browser-local history and JSON, Markdown, CSV exports.
- Tested BM25 retrieval core, fixed and heading-aware chunking, labeled-query evaluation.
- Hit@3 (binary query hit rate) and MRR@3, ranked evidence and JSON export.
- **Before / After**: compare baseline Markdown to the candidate in the editor with the same labeled queries and chunking strategies. Review metric deltas and per-query ranked evidence; export JSON, Markdown, or CSV.

## Run

Requires Node.js 20+.

```bash
npm test
npm run check
npx serve .
```

Or use any static file server. ES modules require serving over HTTP rather than opening `index.html` directly from disk.

## Deploy

Repository: `AzariahOnyx/emetivra`. The existing Vercel project `emetivra` is linked to `main`; push the tested files to the existing repository, and check the production deployment. Framework: Other; no build command; output directory `.`. The GitHub Actions workflow runs tests on pushes and pull requests.

## Accuracy notes

- Document scores are heuristic; they do not measure retrieval quality.
- BM25 is lexical, not semantic retrieval.
- Relevance labels are derived from heading sections. Fixed chunks are relevant if their exact word-offset interval overlaps the target section. This can count tiny overlaps as relevant; a stricter relevance threshold is a future improvement.
- Heading labels must uniquely identify a section **in both baseline and candidate** for paired comparison. A large, independently labeled, representative evaluation set is required for credible conclusions.
- Comparing two documents does not establish causality: wording, section boundaries, corpus size, and lexical overlap may all change BM25 scores.
- A zero metric delta is a valid result. No improvement is assumed or fabricated.
- No model calls, API keys, paid services, or remote document processing.
- Browser history contains full document text; clear it on shared devices.

## Release verification

Run `npm test` and `npm run check`. See `DEPLOYMENT.md` for the GitHub and Vercel steps.

## Before / After evaluation

1. In **Source knowledge**, paste the candidate Markdown document (the *after* version).
2. Open **Before / After**, paste the baseline Markdown (the *before* version).
3. Provide one JSON object per line, for example `{"query":"refresh token","heading":"Refresh access token"}`. The `heading` must exist exactly once in both documents.
4. Run the comparison, inspect fixed and heading-aware Hit@3 / MRR@3 deltas, and expand each query to inspect top-ranked chunks.
5. Export JSON for reproducibility, Markdown for review, or CSV for tabular analysis.

No files are uploaded. The comparison baseline is held in memory only. The main document audit history remains browser-local and may contain document text.