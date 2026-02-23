import { extractSchema } from '../src/extract.js';
import { diffSchemas } from '../src/diff.js';
import { computeStats } from '../src/report-terminal.js';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const connA = process.env.DB_A;
    const connB = process.env.DB_B;
    const labelA = process.env.LABEL_A || 'Database A';
    const labelB = process.env.LABEL_B || 'Database B';

    if (!connA || !connB) {
        return res.status(500).json({
            error: 'Missing DB_A or DB_B environment variables. Configure them in your Vercel project settings.',
        });
    }

    try {
        const [schemaA, schemaB] = await Promise.all([
            extractSchema(connA, labelA),
            extractSchema(connB, labelB),
        ]);

        const diff = diffSchemas(schemaA, schemaB, labelA, labelB);
        const stats = computeStats(diff);

        return res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            labelA,
            labelB,
            stats,
            diff,
        });
    } catch (err) {
        return res.status(500).json({
            error: err.message,
            hint: err.message.includes('ENOTFOUND') || err.message.includes('connect')
                ? 'Check your connection strings: postgresql://user:password@host:port/database'
                : undefined,
        });
    }
}
