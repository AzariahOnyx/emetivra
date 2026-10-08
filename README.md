# EMETIVRA — Knowledge Intelligence Studio

Local-first Markdown documentation auditing and reproducible keyword-retrieval benchmarking.

## Features

- Modern responsive UI with reduced-motion accessibility support.
- Markdown upload and document audit with evidence-linked recommendations.
- Browser-local history and JSON, Markdown, CSV exports.
- Tested BM25 retrieval core, fixed and heading-aware chunking, labeled-query evaluation.
- Hit@3 (binary query hit rate) and MRR@3, ranked evidence and JSON export.

## Run

Requires Node.js 20+.

```bash
npm test
npm run check
npx serve .
```

Or use any static file server. ES modules require serving over HTTP rather than opening `index.html` directly from disk.

## Deploy

Push the files to a GitHub repository, import the repository in Vercel as an **Other** framework with no build command and output directory `.`. The GitHub Actions workflow runs tests on pushes and pull requests.

## Accuracy notes

- Document scores are heuristic; they do not measure retrieval quality.
- BM25 is lexical, not semantic retrieval.
- Relevance labels are derived from heading sections. Fixed chunks are relevant if their exact word-offset interval overlaps the target section. This can count tiny overlaps as relevant; a stricter relevance threshold is a future improvement.
- Heading labels must uniquely identify a section. A large or representative evaluation set is required for credible conclusions.
- No model calls, API keys, paid services, or remote document processing.
- Browser history contains full document text; clear it on shared devices.

## Release verification

Run `npm test` (13 automated tests) and `npm run check`. See `DEPLOYMENT.md` for the GitHub and Vercel steps.