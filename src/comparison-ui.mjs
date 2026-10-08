import { compareDocuments, parseQueryLines, comparisonMarkdown, comparisonCSV } from './comparison.mjs';

const safe = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = n => (n * 100).toFixed(1) + '%';
const signed = n => (n > 0 ? '+' : '') + (n * 100).toFixed(1) + ' pp';
const rr = n => n.toFixed(3);
const download = (value, name, mime) => {
  const blob = new Blob([value], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** In-memory drafts only. Nothing is uploaded or added to browser history. */
export function createComparisonPanel({ getCandidate, getDefaultBaseline, getQueries, notify }) {
  let baseline = getDefaultBaseline(), queryLines = getQueries(), report = null, resultKey = null;
  const fingerprint = () => JSON.stringify([baseline, getCandidate(), queryLines]);
  function renderResults() {
    if (!report) return '<p class="muted">Run a paired evaluation to compare the same questions across both documents.</p>';
    let html = `<div class="finding"><h3>Paired evaluation · ${report.labels.length} labeled queries</h3><p>Baseline: ${report.corpora.baselineWords} words · Candidate: ${report.corpora.candidateWords} words · K=${report.config.k}</p></div>`;
    for (const [strategy, s] of Object.entries(report.strategies)) {
      html += `<div class="finding"><h3>${safe(strategy)} · same BM25 settings</h3><div class="metric-row">`;
      for (const metric of ['hitAtK', 'mrrAtK']) {
        html += `<div class="metric"><small>${metric === 'hitAtK' ? 'Hit@3' : 'MRR@3'}</small><strong>${pct(s.candidate[metric])}</strong><small>Baseline ${pct(s.baseline[metric])} · Δ ${signed(s.delta[metric])}</small></div>`;
      }
      html += `</div><p class="muted">Chunks: ${s.baseline.chunks} → ${s.candidate.chunks}</p></div>`;
      for (const q of s.paired) {
        html += `<details class="finding"><summary>${safe(q.query)} · ${safe(q.heading)} · Hit ${q.baseline.hit} → ${q.candidate.hit}</summary><div class="columns">`;
        for (const [name, data] of [['Baseline', q.baseline], ['Candidate', q.candidate]]) {
          html += `<div><h3>${name} · RR ${rr(data.reciprocalRank)}</h3>`;
          for (const c of data.top) html += `<div class="code">#${c.rank} · ${c.relevant ? 'Relevant' : 'Not relevant'} · BM25 ${c.score.toFixed(3)}\n${safe(c.excerpt.slice(0, 240))}</div>`;
          html += '</div>';
        }
        html += '</div></details>';
      }
    }
    html += `<div class="finding"><h3>Interpretation and limitations</h3><ul>${report.limitations.map(s => `<li>${safe(s)}</li>`).join('')}</ul></div>`;
    return html;
  }
  function render(panel) {
    if (report && resultKey !== fingerprint()) { report = null; resultKey = null; }
    panel.innerHTML = `<p class="muted">Compare a baseline Markdown document with the candidate in the Source knowledge editor. Use identical labeled queries and BM25 settings. No model API calls.</p>
      <label class="compare-label" for="baselineInput">Baseline Markdown (before)</label>
      <textarea id="baselineInput" class="field compare-source" spellcheck="false" aria-label="Baseline Markdown"></textarea>
      <p class="muted">Candidate (after): the current Source knowledge editor above. Changes to either document require a new evaluation.</p>
      <label class="compare-label" for="compareQueries">Shared labeled questions (JSON Lines)</label>
      <textarea id="compareQueries" class="field" spellcheck="false" aria-label="Comparison labeled queries"></textarea>
      <div class="actions"><button class="primary" id="compareBtn">◎ Compare before / after</button><button id="compareJson" ${report ? '' : 'disabled'}>↓ JSON</button><button id="compareMd" ${report ? '' : 'disabled'}>↓ Markdown</button><button id="compareCsv" ${report ? '' : 'disabled'}>↓ CSV</button></div>
      <div id="compareResults" aria-live="polite">${renderResults()}</div>`;
    const b = panel.querySelector('#baselineInput'), q = panel.querySelector('#compareQueries');
    b.value = baseline; q.value = queryLines;
    b.oninput = () => { baseline = b.value; report = null; resultKey = null; panel.querySelector('#compareResults').innerHTML = renderResults(); setExports(false); };
    q.oninput = () => { queryLines = q.value; report = null; resultKey = null; panel.querySelector('#compareResults').innerHTML = renderResults(); setExports(false); };
    function setExports(yes) { for (const id of ['compareJson', 'compareMd', 'compareCsv']) panel.querySelector('#' + id).disabled = !yes; }
    panel.querySelector('#compareBtn').onclick = () => {
      try {
        const labels = parseQueryLines(queryLines);
        const r = compareDocuments(baseline, getCandidate(), labels);
        report = r; resultKey = fingerprint();
        panel.querySelector('#compareResults').innerHTML = renderResults(); setExports(true);
        notify('Comparison complete · ' + labels.length + ' paired questions');
      } catch (e) { report = null; resultKey = null; setExports(false); panel.querySelector('#compareResults').textContent = e.message; notify('Comparison error: ' + e.message); }
    };
    const valid = () => { if (!report || resultKey !== fingerprint()) { notify('Document changed. Run the comparison again.'); setExports(false); return false; } return true; };
    panel.querySelector('#compareJson').onclick = () => valid() && download(JSON.stringify(report, null, 2), 'emetivra-comparison.json', 'application/json');
    panel.querySelector('#compareMd').onclick = () => valid() && download(comparisonMarkdown(report), 'emetivra-comparison.md', 'text/markdown');
    panel.querySelector('#compareCsv').onclick = () => valid() && download(comparisonCSV(report), 'emetivra-comparison.csv', 'text/csv');
  }
  return { render };
}