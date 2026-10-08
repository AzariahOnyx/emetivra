const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = x => (100 * x).toFixed(1) + '%';

export function caseStudyHtml(report) {
  if (!report || report.type !== 'synthetic-answer-span-evaluation') throw Error('Unexpected case study format');
  const entries = Object.entries(report.strategies);
  const cards = entries.map(([name, value]) => {
    const m = value.metrics;
    return `<div class="finding"><h3>${escapeHtml(name)} · ${value.chunkCount} chunks</h3><div class="metric-row"><div class="metric"><small>P@3</small><strong>${fmt(m.precisionAtK)}</strong></div><div class="metric"><small>Recall@3</small><strong>${fmt(m.recallAtK)}</strong></div><div class="metric"><small>Hit@3</small><strong>${fmt(m.hitAtK)}</strong></div><div class="metric"><small>MRR@3</small><strong>${fmt(m.reciprocalRankAtK)}</strong></div><div class="metric"><small>nDCG@3</small><strong>${fmt(m.ndcgAtK)}</strong></div></div></div>`;
  }).join('');
  const failures = entries.map(([name, value]) => {
    const misses = value.results.filter(q => !q.hitAtK);
    return `<div class="finding"><h3>${escapeHtml(name)} · missed queries</h3>${misses.length ? misses.map(q => `<p><b>${escapeHtml(q.id)}</b> — ${escapeHtml(q.query)}</p>`).join('') : '<p>No top-three misses under these synthetic labels.</p>'}</div>`;
  }).join('');
  return `<div class="steps"><h3>v1.1 · Reproducible synthetic case study</h3><p><b>12 author-written queries</b> against a fictional Atlas operations handbook. Labels are generated from exact answer-phrase containment, <b>not independent human judgments</b>. The benchmark is illustrative and cannot establish real-world retrieval improvement.</p><p class="muted">BM25 · K=3 · 70-word chunks · 15-word overlap · k1=1.2 · b=0.75</p></div><div class="columns">${cards}</div><div class="columns">${failures}</div><div class="steps"><h3>Reproduce or inspect</h3><p>Source, question definitions, generated labels, complete ranked evidence, and methodology are committed to GitHub. Run <code>npm run benchmark:case-study</code> to regenerate deterministic outputs.</p><div class="actions"><a href="/benchmarks/v1.1/CASE_STUDY.md" target="_blank" rel="noopener noreferrer">Read methodology ↗</a><a href="/benchmarks/v1.1/report.json" download>↓ Results JSON</a><a href="/benchmarks/v1.1/report.csv" download>↓ Results CSV</a><a href="/benchmarks/v1.1/labels.json" download>↓ Labels JSON</a><a href="/benchmarks/v1.1/corpus.md" target="_blank" rel="noopener noreferrer">View corpus ↗</a></div></div><p class="muted">The data is deliberately small and synthetic. The next research step is an independently reviewed, permission-cleared real-world dataset with pre-registered evaluation criteria.</p>`;
}

export function createCaseStudyPanel() {
  let cached = null;
  return {
    async render(element) {
      if (cached) { element.innerHTML = caseStudyHtml(cached); return; }
      element.textContent = 'Loading committed case study…';
      try {
        const response = await fetch('/benchmarks/v1.1/report.json', { cache: 'no-store' });
        if (!response.ok) throw Error('Report unavailable (HTTP ' + response.status + ')');
        const result = await response.json();
        cached = result;
        if (element.isConnected && element.textContent === 'Loading committed case study…') element.innerHTML = caseStudyHtml(result);
      } catch (error) {
        if (element.isConnected) element.textContent = 'Unable to load case study: ' + error.message;
      }
    }
  };
}
