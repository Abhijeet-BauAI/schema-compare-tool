import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractSchema } from './extract.js';
import { diffSchemas } from './diff.js';
import { computeStats } from './report-terminal.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// ── Load .env file ──
loadEnvFile();

// Pre-load the HTML file
const indexHtml = readFileSync(resolve(__dirname, '..', 'public', 'index.html'), 'utf-8');

const server = createServer(async (req, res) => {
    // ── Health check ──
    if (req.url === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    }

    // ── API endpoint ──
    if (req.url === '/api/compare') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const connA = process.env.DB_A;
        const connB = process.env.DB_B;
        const labelA = process.env.LABEL_A || 'Database A';
        const labelB = process.env.LABEL_B || 'Database B';

        if (!connA || !connB) {
            res.writeHead(500);
            return res.end(JSON.stringify({
                error: 'Missing DB_A or DB_B environment variables.',
            }));
        }

        try {
            console.log(`[${new Date().toISOString()}] Running schema comparison...`);

            const [schemaA, schemaB] = await Promise.all([
                extractSchema(connA, labelA),
                extractSchema(connB, labelB),
            ]);

            const diff = diffSchemas(schemaA, schemaB, labelA, labelB);
            const stats = computeStats(diff);

            console.log(`[${new Date().toISOString()}] Comparison complete.`);

            res.writeHead(200);
            return res.end(JSON.stringify({
                success: true,
                timestamp: new Date().toISOString(),
                labelA, labelB, stats, diff,
            }));
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error:`, err.message);
            res.writeHead(500);
            return res.end(JSON.stringify({
                error: err.message,
                hint: (err.message.includes('ENOTFOUND') || err.message.includes('connect'))
                    ? 'Check your connection strings: postgresql://user:password@host:port/database'
                    : undefined,
            }));
        }
    }

    // ── Serve the frontend ──
    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    res.end(indexHtml);
});

server.listen(PORT);

function loadEnvFile() {
    const envPath = resolve(__dirname, '..', '.env');
    try {
        const content = readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex === -1) continue;
            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
    } catch { /* no .env file — use system env vars */ }
}
