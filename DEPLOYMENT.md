# EMETIVRA v0.9 — GitHub → Vercel release procedure

Existing GitHub repository: `AzariahOnyx/emetivra` (`main`).
Existing Vercel project: `emetivra` under `azariah-onyxs-projects`.
Production domain: https://emetivra.vercel.app

1. Commit the v0.9 source to the **existing** GitHub repository on `main`. Do not create another Vercel project.
2. Confirm GitHub Actions passes `npm run check` and `npm test`.
3. Verify the existing Vercel project's production deployment is READY and points to the new Git commit.
4. Open production and confirm `INTELLIGENCE LAB · 0.9` and the `Before / After` tab are visible.
5. Test paired evaluation with identical documents (zero deltas), then with two different documents, and export JSON/Markdown/CSV.
6. Preserve `emetivra.vercel.app`; do not change domains or project scope.

If CI fails or Vercel does not deploy automatically, do not claim a successful release. Investigate the build/deployment logs and keep the last known good production version.