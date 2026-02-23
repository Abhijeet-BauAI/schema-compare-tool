#!/usr/bin/env node

import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { extractSchema } from './extract.js';
import { diffSchemas } from './diff.js';
import { printTerminalReport } from './report-terminal.js';
import { generateHtmlReport } from './report-html.js';

// ── Load .env file (won't overwrite existing env vars) ──
loadEnvFile();

// ── Parse CLI args ──
const args = process.argv.slice(2);
const flags = parseFlags(args);

async function main() {
    console.log();
    console.log('\x1b[1m\x1b[36m  ┌─────────────────────────────────────┐\x1b[0m');
    console.log('\x1b[1m\x1b[36m  │   Schema Compare - DB Diff Tool     │\x1b[0m');
    console.log('\x1b[1m\x1b[36m  └─────────────────────────────────────┘\x1b[0m');
    console.log();

    // Get connection strings — from flags, env vars, or interactive prompts
    let connA = flags['--db-a'] || flags['-a'] || process.env.DB_A;
    let connB = flags['--db-b'] || flags['-b'] || process.env.DB_B;
    let labelA = flags['--label-a'] || process.env.LABEL_A || 'Database A';
    let labelB = flags['--label-b'] || process.env.LABEL_B || 'Database B';

    if (flags['--help'] || flags['-h']) {
        printHelp();
        process.exit(0);
    }

    if (!connA) connA = await prompt('  Enter connection string for Database A:\n  > ');
    if (!connB) connB = await prompt('  Enter connection string for Database B:\n  > ');
    if (labelA === 'Database A') labelA = await prompt('  Label for Database A (default: "Database A"):\n  > ') || 'Database A';
    if (labelB === 'Database B') labelB = await prompt('  Label for Database B (default: "Database B"):\n  > ') || 'Database B';

    if (!connA || !connB) {
        console.error('\x1b[31m  ✗ Both connection strings are required.\x1b[0m');
        process.exit(1);
    }

    console.log();
    console.log('\x1b[1m  Extracting schemas...\x1b[0m');

    try {
        const [schemaA, schemaB] = await Promise.all([
            extractSchema(connA, labelA),
            extractSchema(connB, labelB),
        ]);

        console.log('\x1b[1m  Comparing schemas...\x1b[0m');
        const diff = diffSchemas(schemaA, schemaB, labelA, labelB);

        // Terminal report
        printTerminalReport(diff);

        // JSON output
        if (flags['--json']) {
            const jsonPath = resolve(flags['--json'] === true ? 'schema-diff.json' : flags['--json']);
            const { writeFileSync } = await import('fs');
            writeFileSync(jsonPath, JSON.stringify(diff, null, 2), 'utf-8');
            console.log(`\x1b[32m  ✓ JSON report saved to: ${jsonPath}\x1b[0m`);
        }

        // HTML report
        const htmlOut = flags['--html'] || flags['--save'];
        if (htmlOut !== undefined) {
            const htmlPath = resolve(typeof htmlOut === 'string' && htmlOut !== '' ? htmlOut : 'schema-diff-report.html');
            generateHtmlReport(diff, htmlPath);
            console.log(`\x1b[32m  ✓ HTML report saved to: ${htmlPath}\x1b[0m`);

            // Try to open in browser
            if (!flags['--no-open']) {
                try {
                    const { exec } = await import('child_process');
                    const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
                    exec(`${cmd} "${htmlPath}"`);
                } catch { /* ignore */ }
            }
        }

        console.log();
    } catch (err) {
        console.error(`\x1b[31m  ✗ Error: ${err.message}\x1b[0m`);
        if (err.message.includes('ENOTFOUND') || err.message.includes('connect')) {
            console.error('\x1b[33m  Hint: Check your connection string format:\x1b[0m');
            console.error('\x1b[33m  postgresql://user:password@host:port/database\x1b[0m');
        }
        process.exit(1);
    }
}

// ── Helpers ──

function parseFlags(args) {
    const flags = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('-')) {
            const next = args[i + 1];
            if (next && !next.startsWith('-')) {
                flags[arg] = next;
                i++;
            } else {
                flags[arg] = true;
            }
        }
    }
    return flags;
}

function prompt(question) {
    return new Promise(resolve => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function printHelp() {
    console.log(`
  \x1b[1mUSAGE\x1b[0m

    node src/index.js [options]

  \x1b[1mOPTIONS\x1b[0m

    -a, --db-a <url>       Connection string for Database A
    -b, --db-b <url>       Connection string for Database B
    --label-a <name>       Label for Database A (default: "Database A")
    --label-b <name>       Label for Database B (default: "Database B")
    --html [path]          Generate HTML report (default: schema-diff-report.html)
    --save [path]          Alias for --html
    --json [path]          Save diff as JSON (default: schema-diff.json)
    --no-open              Don't auto-open HTML report in browser
    -h, --help             Show this help

  \x1b[1mENV VARS\x1b[0m

    DB_A                   Connection string for Database A
    DB_B                   Connection string for Database B
    LABEL_A                Label for Database A
    LABEL_B                Label for Database B

  \x1b[1mEXAMPLES\x1b[0m

    # Interactive mode — will prompt for connection strings
    node src/index.js

    # With flags
    node src/index.js -a "postgresql://..." -b "postgresql://..." --html

    # With .env file (create a .env in the project root)
    node src/index.js --html

    # With labels
    node src/index.js -a "..." -b "..." --label-a "Production" --label-b "Development" --html
  `);
}

function loadEnvFile() {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envPath = resolve(__dirname, '..', '.env');
    if (!existsSync(envPath)) return;
    try {
        const content = readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1) continue;
            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();
            // Strip surrounding quotes
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            // Don't overwrite existing env vars
            if (process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
    } catch { /* .env read failed — continue without it */ }
}

main();
