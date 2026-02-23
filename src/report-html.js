import { writeFileSync } from 'fs';
import { computeStats } from './report-terminal.js';

/**
 * Generate a self-contained HTML report and save it to disk.
 */
export function generateHtmlReport(diff, outputPath) {
    const stats = computeStats(diff);
    const html = buildHtml(diff, stats);
    writeFileSync(outputPath, html, 'utf-8');
    return outputPath;
}

function buildHtml(diff, stats) {
    const { labelA, labelB } = diff;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Schema Comparison: ${esc(labelA)} vs ${esc(labelB)}</title>
<style>
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --text-dim: #8b949e; --accent: #58a6ff;
    --green: #3fb950; --blue: #58a6ff; --yellow: #d29922;
    --red: #f85149; --magenta: #bc8cff; --cyan: #39d2c0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem; }
  .container { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 1.75rem; margin-bottom: 0.5rem; background: linear-gradient(135deg, var(--cyan), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .subtitle { color: var(--text-dim); margin-bottom: 2rem; font-size: 0.95rem; }
  .labels { display: flex; gap: 2rem; margin-bottom: 2rem; }
  .label-badge { padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; font-size: 0.9rem; }
  .label-a { background: rgba(188, 140, 255, 0.15); border: 1px solid var(--magenta); color: var(--magenta); }
  .label-b { background: rgba(88, 166, 255, 0.15); border: 1px solid var(--blue); color: var(--blue); }

  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.25rem; }
  .stat-card h3 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 0.5rem; }
  .stat-row { display: flex; gap: 0.75rem; font-size: 0.85rem; flex-wrap: wrap; }
  .stat-row span { padding: 2px 8px; border-radius: 6px; font-weight: 600; }
  .s-a { background: rgba(63, 185, 80, 0.15); color: var(--green); }
  .s-b { background: rgba(88, 166, 255, 0.15); color: var(--blue); }
  .s-c { background: rgba(210, 153, 34, 0.15); color: var(--yellow); }
  .s-n { background: rgba(139, 148, 158, 0.1); color: var(--text-dim); }

  .section { margin-bottom: 2rem; }
  .section-header { font-size: 1.1rem; font-weight: 700; padding: 0.75rem 0; border-bottom: 2px solid var(--border); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none; }
  .section-header::before { content: '▸'; transition: transform 0.2s; }
  .section-header.open::before { transform: rotate(90deg); }
  .section-body { display: none; }
  .section-body.open { display: block; }

  .diff-group { margin-bottom: 1rem; }
  .diff-group-title { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.5rem; color: var(--accent); }
  .diff-item { padding: 0.35rem 0.75rem; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.82rem; border-radius: 6px; margin-bottom: 2px; }
  .diff-a { background: rgba(63, 185, 80, 0.1); color: var(--green); border-left: 3px solid var(--green); }
  .diff-b { background: rgba(88, 166, 255, 0.1); color: var(--blue); border-left: 3px solid var(--blue); }
  .diff-c { background: rgba(210, 153, 34, 0.08); color: var(--yellow); border-left: 3px solid var(--yellow); }

  table.col-diff { width: 100%; border-collapse: collapse; margin: 0.5rem 0 1rem; font-size: 0.82rem; }
  table.col-diff th { text-align: left; padding: 0.4rem 0.75rem; background: var(--surface); border: 1px solid var(--border); color: var(--text-dim); font-weight: 600; }
  table.col-diff td { padding: 0.4rem 0.75rem; border: 1px solid var(--border); font-family: 'JetBrains Mono', monospace; }
  .val-a { color: var(--magenta); }
  .val-b { color: var(--cyan); }

  .empty-state { color: var(--text-dim); font-style: italic; padding: 1rem; text-align: center; }
  .timestamp { text-align: center; color: var(--text-dim); font-size: 0.8rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); }

  @media (max-width: 600px) { body { padding: 1rem; } .labels { flex-direction: column; gap: 0.5rem; } }
</style>
</head>
<body>
<div class="container">
  <h1>Schema Comparison Report</h1>
  <p class="subtitle">Generated ${new Date().toLocaleString()}</p>
  <div class="labels">
    <span class="label-badge label-a">A: ${esc(labelA)}</span>
    <span class="label-badge label-b">B: ${esc(labelB)}</span>
  </div>

  ${renderStats(stats)}
  ${renderTablesSection(diff, labelA, labelB)}
  ${renderColumnsSection(diff, labelA, labelB)}
  ${renderSimpleSection('Indexes', diff.indexes, labelA, labelB)}
  ${renderSimpleSection('Foreign Keys', diff.foreignKeys, labelA, labelB)}
  ${renderEnumsSection(diff, labelA, labelB)}
  ${renderSimpleSection('RLS Policies', diff.policies, labelA, labelB)}
  ${renderSimpleSection('Functions', diff.functions, labelA, labelB)}
  ${renderSimpleSection('Triggers', diff.triggers, labelA, labelB)}

  <div class="timestamp">schema-compare tool · ${new Date().toISOString()}</div>
</div>
<script>
document.querySelectorAll('.section-header').forEach(h => {
  h.addEventListener('click', () => {
    h.classList.toggle('open');
    h.nextElementSibling.classList.toggle('open');
  });
  // Auto-open sections with content
  const body = h.nextElementSibling;
  if (body && body.innerHTML.trim() && !body.querySelector('.empty-state')) {
    h.classList.add('open');
    body.classList.add('open');
  }
});
</script>
</body>
</html>`;
}

function renderStats(s) {
    return `<div class="stats-grid">
    ${statCard('Tables', s.tablesOnlyA, s.tablesOnlyB, 0, s.tablesCommon)}
    ${statCard('Columns', s.columnsOnlyA, s.columnsOnlyB, s.columnsChanged)}
    ${statCard('Indexes', s.indexesOnlyA, s.indexesOnlyB, s.indexesChanged)}
    ${statCard('Foreign Keys', s.fksOnlyA, s.fksOnlyB, s.fksChanged)}
    ${statCard('Enums', s.enumsOnlyA, s.enumsOnlyB, s.enumsChanged)}
    ${statCard('RLS Policies', s.policiesOnlyA, s.policiesOnlyB, s.policiesChanged)}
    ${statCard('Functions', s.functionsOnlyA, s.functionsOnlyB, s.functionsChanged)}
    ${statCard('Triggers', s.triggersOnlyA, s.triggersOnlyB, s.triggersChanged)}
  </div>`;
}

function statCard(title, a, b, changed, shared) {
    return `<div class="stat-card"><h3>${title}</h3><div class="stat-row">
    <span class="s-a">A: ${a}</span><span class="s-b">B: ${b}</span>
    ${changed ? `<span class="s-c">Δ ${changed}</span>` : ''}
    ${shared !== undefined ? `<span class="s-n">= ${shared}</span>` : ''}
  </div></div>`;
}

function renderTablesSection(diff, labelA, labelB) {
    const { onlyInA, onlyInB } = diff.tables;
    const hasContent = onlyInA.length || onlyInB.length;
    return `<div class="section">
    <div class="section-header">Tables</div>
    <div class="section-body">
      ${!hasContent ? '<div class="empty-state">All tables are identical</div>' : ''}
      ${onlyInA.length ? `<div class="diff-group"><div class="diff-group-title">Only in A (${esc(labelA)})</div>${onlyInA.map(t => `<div class="diff-item diff-a">+ ${esc(t)}</div>`).join('')}</div>` : ''}
      ${onlyInB.length ? `<div class="diff-group"><div class="diff-group-title">Only in B (${esc(labelB)})</div>${onlyInB.map(t => `<div class="diff-item diff-b">+ ${esc(t)}</div>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

function renderColumnsSection(diff, labelA, labelB) {
    const tables = Object.keys(diff.columns);
    return `<div class="section">
    <div class="section-header">Column Differences</div>
    <div class="section-body">
      ${!tables.length ? '<div class="empty-state">All columns are identical</div>' : ''}
      ${tables.map(table => {
        const d = diff.columns[table];
        return `<div class="diff-group"><div class="diff-group-title">${esc(table)}</div>
          ${d.onlyInA.map(c => `<div class="diff-item diff-a">+ [A only] ${esc(c)}</div>`).join('')}
          ${d.onlyInB.map(c => `<div class="diff-item diff-b">+ [B only] ${esc(c)}</div>`).join('')}
          ${d.changed.length ? `<table class="col-diff"><tr><th>Column</th><th>Property</th><th>A</th><th>B</th></tr>
            ${d.changed.map(ch => ch.differences.map(df =>
            `<tr><td>${esc(ch.column)}</td><td>${esc(df.field)}</td><td class="val-a">${esc(String(df.valueA))}</td><td class="val-b">${esc(String(df.valueB))}</td></tr>`
        ).join('')).join('')}
          </table>` : ''}
        </div>`;
    }).join('')}
    </div>
  </div>`;
}

function renderEnumsSection(diff, labelA, labelB) {
    const { onlyInA, onlyInB, changed } = diff.enums;
    const hasContent = onlyInA.length || onlyInB.length || changed.length;
    return `<div class="section">
    <div class="section-header">Enums</div>
    <div class="section-body">
      ${!hasContent ? '<div class="empty-state">All enums are identical</div>' : ''}
      ${onlyInA.length ? `<div class="diff-group"><div class="diff-group-title">Only in A</div>${onlyInA.map(e => `<div class="diff-item diff-a">+ ${esc(e)}</div>`).join('')}</div>` : ''}
      ${onlyInB.length ? `<div class="diff-group"><div class="diff-group-title">Only in B</div>${onlyInB.map(e => `<div class="diff-item diff-b">+ ${esc(e)}</div>`).join('')}</div>` : ''}
      ${changed.map(ch => `<div class="diff-group"><div class="diff-group-title">${esc(ch.name)}</div>
        <div class="diff-item diff-c">A: ${esc(ch.valuesA.join(', '))}</div>
        <div class="diff-item diff-c">B: ${esc(ch.valuesB.join(', '))}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

function renderSimpleSection(title, section, labelA, labelB) {
    const hasContent = section.onlyInA.length || section.onlyInB.length || section.changed.length;
    return `<div class="section">
    <div class="section-header">${esc(title)}</div>
    <div class="section-body">
      ${!hasContent ? `<div class="empty-state">All ${title.toLowerCase()} are identical</div>` : ''}
      ${section.onlyInA.length ? `<div class="diff-group"><div class="diff-group-title">Only in A (${esc(labelA)}): ${section.onlyInA.length}</div>${section.onlyInA.map(k => `<div class="diff-item diff-a">+ ${esc(k)}</div>`).join('')}</div>` : ''}
      ${section.onlyInB.length ? `<div class="diff-group"><div class="diff-group-title">Only in B (${esc(labelB)}): ${section.onlyInB.length}</div>${section.onlyInB.map(k => `<div class="diff-item diff-b">+ ${esc(k)}</div>`).join('')}</div>` : ''}
      ${section.changed.length ? `<div class="diff-group"><div class="diff-group-title">Changed: ${section.changed.length}</div>${section.changed.map(ch => `<div class="diff-item diff-c">~ ${esc(ch.key)}</div>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
