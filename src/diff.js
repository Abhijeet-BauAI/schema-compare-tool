/**
 * Compare two extracted schemas and produce a structured diff result.
 */
export function diffSchemas(schemaA, schemaB, labelA = 'Database A', labelB = 'Database B') {
    return {
        labelA,
        labelB,
        tables: diffTables(schemaA, schemaB),
        columns: diffColumns(schemaA, schemaB),
        indexes: diffIndexes(schemaA, schemaB),
        foreignKeys: diffForeignKeys(schemaA, schemaB),
        enums: diffEnums(schemaA, schemaB),
        policies: diffPolicies(schemaA, schemaB),
        functions: diffFunctions(schemaA, schemaB),
        triggers: diffTriggers(schemaA, schemaB),
    };
}

// ---------- Tables ----------
function diffTables(a, b) {
    const namesA = new Set(a.tables.map(t => t.table_name));
    const namesB = new Set(b.tables.map(t => t.table_name));
    return {
        onlyInA: [...namesA].filter(n => !namesB.has(n)).sort(),
        onlyInB: [...namesB].filter(n => !namesA.has(n)).sort(),
        common: [...namesA].filter(n => namesB.has(n)).sort(),
    };
}

// ---------- Columns ----------
function diffColumns(a, b) {
    const mapA = groupBy(a.columns, c => c.table_name);
    const mapB = groupBy(b.columns, c => c.table_name);
    const allTables = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);

    const result = {};
    for (const table of allTables) {
        const colsA = mapA[table] || [];
        const colsB = mapB[table] || [];
        const colNamesA = new Set(colsA.map(c => c.column_name));
        const colNamesB = new Set(colsB.map(c => c.column_name));

        const onlyInA = [...colNamesA].filter(n => !colNamesB.has(n));
        const onlyInB = [...colNamesB].filter(n => !colNamesA.has(n));
        const changed = [];

        for (const name of colNamesA) {
            if (!colNamesB.has(name)) continue;
            const cA = colsA.find(c => c.column_name === name);
            const cB = colsB.find(c => c.column_name === name);
            const diffs = compareColumnDetails(cA, cB);
            if (diffs.length > 0) {
                changed.push({ column: name, differences: diffs });
            }
        }

        if (onlyInA.length || onlyInB.length || changed.length) {
            result[table] = { onlyInA, onlyInB, changed };
        }
    }
    return result;
}

function compareColumnDetails(a, b) {
    const fields = [
        'data_type', 'udt_name', 'character_maximum_length',
        'numeric_precision', 'numeric_scale', 'is_nullable',
        'column_default', 'is_identity', 'identity_generation',
        'is_generated', 'generation_expression',
    ];
    const diffs = [];
    for (const f of fields) {
        const vA = normalize(a[f]);
        const vB = normalize(b[f]);
        if (vA !== vB) {
            diffs.push({ field: f, valueA: a[f], valueB: b[f] });
        }
    }
    return diffs;
}

// ---------- Indexes ----------
function diffIndexes(a, b) {
    const keyFn = i => `${i.tablename}::${i.indexname}`;
    const mapA = new Map(a.indexes.map(i => [keyFn(i), i.indexdef]));
    const mapB = new Map(b.indexes.map(i => [keyFn(i), i.indexdef]));

    return {
        onlyInA: [...mapA.keys()].filter(k => !mapB.has(k)).sort(),
        onlyInB: [...mapB.keys()].filter(k => !mapA.has(k)).sort(),
        changed: [...mapA.keys()]
            .filter(k => mapB.has(k) && mapA.get(k) !== mapB.get(k))
            .map(k => ({ key: k, defA: mapA.get(k), defB: mapB.get(k) })),
    };
}

// ---------- Foreign Keys ----------
function diffForeignKeys(a, b) {
    const keyFn = fk => `${fk.table_name}.${fk.constraint_name}`;
    const valFn = fk => `${fk.column_name}->${fk.foreign_table_name}.${fk.foreign_column_name}`;
    const mapA = new Map(a.foreignKeys.map(f => [keyFn(f), valFn(f)]));
    const mapB = new Map(b.foreignKeys.map(f => [keyFn(f), valFn(f)]));

    return {
        onlyInA: [...mapA.keys()].filter(k => !mapB.has(k)).sort(),
        onlyInB: [...mapB.keys()].filter(k => !mapA.has(k)).sort(),
        changed: [...mapA.keys()]
            .filter(k => mapB.has(k) && mapA.get(k) !== mapB.get(k))
            .map(k => ({ key: k, valueA: mapA.get(k), valueB: mapB.get(k) })),
    };
}

// ---------- Enums ----------
function diffEnums(a, b) {
    const buildMap = (enums) => {
        const map = {};
        for (const e of enums) {
            if (!map[e.enum_name]) map[e.enum_name] = [];
            map[e.enum_name].push(e.enum_value);
        }
        return map;
    };
    const mapA = buildMap(a.enums);
    const mapB = buildMap(b.enums);
    const namesA = new Set(Object.keys(mapA));
    const namesB = new Set(Object.keys(mapB));

    const changed = [];
    for (const name of namesA) {
        if (!namesB.has(name)) continue;
        const valsA = mapA[name].sort();
        const valsB = mapB[name].sort();
        if (JSON.stringify(valsA) !== JSON.stringify(valsB)) {
            changed.push({ name, valuesA: valsA, valuesB: valsB });
        }
    }

    return {
        onlyInA: [...namesA].filter(n => !namesB.has(n)).sort(),
        onlyInB: [...namesB].filter(n => !namesA.has(n)).sort(),
        changed,
    };
}

// ---------- RLS Policies ----------
function diffPolicies(a, b) {
    const keyFn = p => `${p.tablename}::${p.policyname}`;
    const valFn = p => JSON.stringify({ permissive: p.permissive, roles: p.roles, cmd: p.cmd, qual: p.qual, with_check: p.with_check });
    const mapA = new Map(a.policies.map(p => [keyFn(p), valFn(p)]));
    const mapB = new Map(b.policies.map(p => [keyFn(p), valFn(p)]));

    return {
        onlyInA: [...mapA.keys()].filter(k => !mapB.has(k)).sort(),
        onlyInB: [...mapB.keys()].filter(k => !mapA.has(k)).sort(),
        changed: [...mapA.keys()]
            .filter(k => mapB.has(k) && mapA.get(k) !== mapB.get(k))
            .map(k => ({ key: k, valueA: mapA.get(k), valueB: mapB.get(k) })),
    };
}

// ---------- Functions ----------
function diffFunctions(a, b) {
    const keyFn = f => `${f.function_name}(${f.arguments})`;
    const valFn = f => JSON.stringify({ return_type: f.return_type, kind: f.kind, security_definer: f.security_definer, language: f.language });
    const mapA = new Map(a.functions.map(f => [keyFn(f), valFn(f)]));
    const mapB = new Map(b.functions.map(f => [keyFn(f), valFn(f)]));

    return {
        onlyInA: [...mapA.keys()].filter(k => !mapB.has(k)).sort(),
        onlyInB: [...mapB.keys()].filter(k => !mapA.has(k)).sort(),
        changed: [...mapA.keys()]
            .filter(k => mapB.has(k) && mapA.get(k) !== mapB.get(k))
            .map(k => ({ key: k, signatureA: mapA.get(k), signatureB: mapB.get(k) })),
    };
}

// ---------- Triggers ----------
function diffTriggers(a, b) {
    const keyFn = t => `${t.event_object_table}::${t.trigger_name}::${t.event_manipulation}`;
    const valFn = t => JSON.stringify({ action_statement: t.action_statement, action_timing: t.action_timing, action_orientation: t.action_orientation });
    const mapA = new Map(a.triggers.map(t => [keyFn(t), valFn(t)]));
    const mapB = new Map(b.triggers.map(t => [keyFn(t), valFn(t)]));

    return {
        onlyInA: [...mapA.keys()].filter(k => !mapB.has(k)).sort(),
        onlyInB: [...mapB.keys()].filter(k => !mapA.has(k)).sort(),
        changed: [...mapA.keys()]
            .filter(k => mapB.has(k) && mapA.get(k) !== mapB.get(k))
            .map(k => ({ key: k, valueA: mapA.get(k), valueB: mapB.get(k) })),
    };
}

// ---------- Helpers ----------
function normalize(v) {
    if (v === null || v === undefined) return '';
    return String(v).trim();
}

function groupBy(arr, fn) {
    const result = {};
    for (const item of arr) {
        const key = fn(item);
        if (!result[key]) result[key] = [];
        result[key].push(item);
    }
    return result;
}
