/**
 * Print a color-coded schema diff report to the terminal.
 */
export function printTerminalReport(diff) {
    const { labelA, labelB } = diff;
    const c = colors;

    console.log();
    console.log(c.bold(c.cyan('╔══════════════════════════════════════════════════════════════╗')));
    console.log(c.bold(c.cyan('║          DATABASE SCHEMA COMPARISON REPORT                  ║')));
    console.log(c.bold(c.cyan('╚══════════════════════════════════════════════════════════════╝')));
    console.log();
    console.log(`  ${c.bold('A')}: ${c.magenta(labelA)}`);
    console.log(`  ${c.bold('B')}: ${c.blue(labelB)}`);
    console.log();

    // ── Summary ──
    const stats = computeStats(diff);
    console.log(c.bold('─── SUMMARY ───────────────────────────────────────────────────'));
    console.log(`  Tables:     ${c.green(stats.tablesOnlyA + ' only in A')}  │  ${c.blue(stats.tablesOnlyB + ' only in B')}  │  ${c.white(stats.tablesCommon + ' shared')}`);
    console.log(`  Columns:    ${c.yellow(stats.columnsChanged + ' changed')}  │  ${c.green(stats.columnsOnlyA + ' only in A')}  │  ${c.blue(stats.columnsOnlyB + ' only in B')}`);
    console.log(`  Indexes:    ${c.green(stats.indexesOnlyA + ' only in A')}  │  ${c.blue(stats.indexesOnlyB + ' only in B')}  │  ${c.yellow(stats.indexesChanged + ' changed')}`);
    console.log(`  ForeignKeys:${c.green(stats.fksOnlyA + ' only in A')}  │  ${c.blue(stats.fksOnlyB + ' only in B')}  │  ${c.yellow(stats.fksChanged + ' changed')}`);
    console.log(`  Enums:      ${c.green(stats.enumsOnlyA + ' only in A')}  │  ${c.blue(stats.enumsOnlyB + ' only in B')}  │  ${c.yellow(stats.enumsChanged + ' changed')}`);
    console.log(`  Policies:   ${c.green(stats.policiesOnlyA + ' only in A')}  │  ${c.blue(stats.policiesOnlyB + ' only in B')}  │  ${c.yellow(stats.policiesChanged + ' changed')}`);
    console.log(`  Functions:  ${c.green(stats.functionsOnlyA + ' only in A')}  │  ${c.blue(stats.functionsOnlyB + ' only in B')}  │  ${c.yellow(stats.functionsChanged + ' changed')}`);
    console.log(`  Triggers:   ${c.green(stats.triggersOnlyA + ' only in A')}  │  ${c.blue(stats.triggersOnlyB + ' only in B')}  │  ${c.yellow(stats.triggersChanged + ' changed')}`);
    console.log();

    // ── Tables ──
    if (diff.tables.onlyInA.length || diff.tables.onlyInB.length) {
        console.log(c.bold('─── TABLES ────────────────────────────────────────────────────'));
        if (diff.tables.onlyInA.length) {
            console.log(c.green(`  Only in A (${labelA}):`));
            diff.tables.onlyInA.forEach(t => console.log(c.green(`    + ${t}`)));
        }
        if (diff.tables.onlyInB.length) {
            console.log(c.blue(`  Only in B (${labelB}):`));
            diff.tables.onlyInB.forEach(t => console.log(c.blue(`    + ${t}`)));
        }
        console.log();
    }

    // ── Columns ──
    const colTables = Object.keys(diff.columns);
    if (colTables.length) {
        console.log(c.bold('─── COLUMN DIFFERENCES ────────────────────────────────────────'));
        for (const table of colTables) {
            const d = diff.columns[table];
            console.log(c.bold(`\n  Table: ${table}`));
            if (d.onlyInA.length) {
                d.onlyInA.forEach(col => console.log(c.green(`    + [A only] ${col}`)));
            }
            if (d.onlyInB.length) {
                d.onlyInB.forEach(col => console.log(c.blue(`    + [B only] ${col}`)));
            }
            if (d.changed.length) {
                for (const ch of d.changed) {
                    console.log(c.yellow(`    ~ ${ch.column}:`));
                    for (const df of ch.differences) {
                        console.log(c.yellow(`        ${df.field}: ${c.magenta(String(df.valueA))} → ${c.cyan(String(df.valueB))}`));
                    }
                }
            }
        }
        console.log();
    }

    // ── Indexes ──
    printSimpleSection('INDEXES', diff.indexes, labelA, labelB);

    // ── Foreign Keys ──
    printSimpleSection('FOREIGN KEYS', diff.foreignKeys, labelA, labelB);

    // ── Enums ──
    if (diff.enums.onlyInA.length || diff.enums.onlyInB.length || diff.enums.changed.length) {
        console.log(c.bold('─── ENUMS ─────────────────────────────────────────────────────'));
        if (diff.enums.onlyInA.length) {
            console.log(c.green(`  Only in A: ${diff.enums.onlyInA.join(', ')}`));
        }
        if (diff.enums.onlyInB.length) {
            console.log(c.blue(`  Only in B: ${diff.enums.onlyInB.join(', ')}`));
        }
        for (const ch of diff.enums.changed) {
            console.log(c.yellow(`  ~ ${ch.name}:`));
            console.log(c.magenta(`      A: ${ch.valuesA.join(', ')}`));
            console.log(c.cyan(`      B: ${ch.valuesB.join(', ')}`));
        }
        console.log();
    }

    // ── RLS Policies ──
    printSimpleSection('RLS POLICIES', diff.policies, labelA, labelB);

    // ── Functions ──
    printSimpleSection('FUNCTIONS', diff.functions, labelA, labelB);

    // ── Triggers ──
    printSimpleSection('TRIGGERS', diff.triggers, labelA, labelB);

    console.log(c.bold(c.cyan('══════════════════════════════════════════════════════════════')));
    console.log();
}

function printSimpleSection(title, section, labelA, labelB) {
    const c = colors;
    if (!section.onlyInA.length && !section.onlyInB.length && !section.changed.length) return;

    console.log(c.bold(`─── ${title} ${'─'.repeat(Math.max(0, 60 - title.length - 5))}`));
    if (section.onlyInA.length) {
        console.log(c.green(`  Only in A (${labelA}): ${section.onlyInA.length} items`));
        section.onlyInA.slice(0, 15).forEach(k => console.log(c.green(`    + ${k}`)));
        if (section.onlyInA.length > 15) console.log(c.dim(`    ... and ${section.onlyInA.length - 15} more`));
    }
    if (section.onlyInB.length) {
        console.log(c.blue(`  Only in B (${labelB}): ${section.onlyInB.length} items`));
        section.onlyInB.slice(0, 15).forEach(k => console.log(c.blue(`    + ${k}`)));
        if (section.onlyInB.length > 15) console.log(c.dim(`    ... and ${section.onlyInB.length - 15} more`));
    }
    if (section.changed.length) {
        console.log(c.yellow(`  Changed: ${section.changed.length} items`));
        section.changed.slice(0, 10).forEach(ch => {
            console.log(c.yellow(`    ~ ${ch.key}`));
        });
        if (section.changed.length > 10) console.log(c.dim(`    ... and ${section.changed.length - 10} more`));
    }
    console.log();
}

function computeStats(diff) {
    let columnsOnlyA = 0, columnsOnlyB = 0, columnsChanged = 0;
    for (const table of Object.values(diff.columns)) {
        columnsOnlyA += table.onlyInA.length;
        columnsOnlyB += table.onlyInB.length;
        columnsChanged += table.changed.length;
    }
    return {
        tablesOnlyA: diff.tables.onlyInA.length,
        tablesOnlyB: diff.tables.onlyInB.length,
        tablesCommon: diff.tables.common.length,
        columnsOnlyA, columnsOnlyB, columnsChanged,
        indexesOnlyA: diff.indexes.onlyInA.length,
        indexesOnlyB: diff.indexes.onlyInB.length,
        indexesChanged: diff.indexes.changed.length,
        fksOnlyA: diff.foreignKeys.onlyInA.length,
        fksOnlyB: diff.foreignKeys.onlyInB.length,
        fksChanged: diff.foreignKeys.changed.length,
        enumsOnlyA: diff.enums.onlyInA.length,
        enumsOnlyB: diff.enums.onlyInB.length,
        enumsChanged: diff.enums.changed.length,
        policiesOnlyA: diff.policies.onlyInA.length,
        policiesOnlyB: diff.policies.onlyInB.length,
        policiesChanged: diff.policies.changed.length,
        functionsOnlyA: diff.functions.onlyInA.length,
        functionsOnlyB: diff.functions.onlyInB.length,
        functionsChanged: diff.functions.changed.length,
        triggersOnlyA: diff.triggers.onlyInA.length,
        triggersOnlyB: diff.triggers.onlyInB.length,
        triggersChanged: diff.triggers.changed.length,
    };
}

// ── Tiny ANSI color helpers (zero deps) ──
const colors = {
    bold: s => `\x1b[1m${s}\x1b[22m`,
    dim: s => `\x1b[2m${s}\x1b[22m`,
    red: s => `\x1b[31m${s}\x1b[39m`,
    green: s => `\x1b[32m${s}\x1b[39m`,
    yellow: s => `\x1b[33m${s}\x1b[39m`,
    blue: s => `\x1b[34m${s}\x1b[39m`,
    magenta: s => `\x1b[35m${s}\x1b[39m`,
    cyan: s => `\x1b[36m${s}\x1b[39m`,
    white: s => `\x1b[37m${s}\x1b[39m`,
};

export { computeStats };
