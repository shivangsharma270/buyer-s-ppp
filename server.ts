import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Redshift Pool Configuration (Hardcoded as requested)
  const pool = new Pool({
    user: 'rd_shivang_113816',
    host: 'bi-dwh-redshift-development.c98rtyhhgrpm.ap-south-1.redshift.amazonaws.com',
    database: 'biredshiftdevelopment',
    password: '0fS8t9FishvZ',
    port: 5439,
    ssl: {
      rejectUnauthorized: false
    }
  });

  app.use(express.json());

  // API Route for Tickets
  app.get('/api/tickets', async (req, res) => {
    const { start_date, end_date } = req.query;
    
    // Fallback to the ones in the requirement if not provided by frontend
    const start = start_date || '2026-03-29';
    const end = end_date || '2026-04-04';

    const tsQuery = `
      SELECT 
          COUNT(*) AS TS_Ticket_Count 
      FROM im_dwh_rpt.fact_iil_customer_tickets A
      JOIN im_dwh_rpt.fact_iil_customer_tickets_type B
          ON A.customer_ticket_id = B.fk_iil_customer_tickets_id 
      JOIN im_dwh_rpt.dim_glusr_usr C
          ON A.respondent_glusr_id = C.glusr_usr_id
      WHERE B.fk_type_id = 181 
          AND DATE(A.customer_ticket_issuedate) >= DATE($1)
          AND DATE(A.customer_ticket_issuedate) <= DATE($2)
          AND glusr_usr_custtype_weight < 699;
    `;

    const paidBsQuery = `
      SELECT COUNT(*) AS total_count
      FROM im_dwh_rpt.fact_iil_customer_tickets A
      JOIN im_dwh_rpt.fact_iil_customer_tickets_type B
          ON A.customer_ticket_id = B.fk_iil_customer_tickets_id 
      JOIN im_dwh_rpt.dim_glusr_usr C
          ON A.respondent_glusr_id = C.glusr_usr_id
      WHERE B.fk_type_id = 181 
          AND DATE(A.customer_ticket_issuedate) BETWEEN DATE($1) AND DATE($2)
          AND glusr_usr_custtype_weight <= 700;
    `;

    const freeBsQuery = `
      SELECT COUNT(*) AS total_count
      FROM im_dwh_rpt.fact_iil_customer_tickets A
      JOIN im_dwh_rpt.fact_iil_customer_tickets_type B
          ON A.customer_ticket_id = B.fk_iil_customer_tickets_id 
      JOIN im_dwh_rpt.dim_glusr_usr C
          ON A.respondent_glusr_id = C.glusr_usr_id
      WHERE B.fk_type_id = 181 
          AND DATE(A.customer_ticket_issuedate) BETWEEN DATE($1) AND DATE($2)
          AND glusr_usr_custtype_weight > 700;
    `;

    try {
      const [tsResult, paidResult, freeResult] = await Promise.all([
        pool.query(tsQuery, [start, end]),
        pool.query(paidBsQuery, [start, end]),
        pool.query(freeBsQuery, [start, end])
      ]);

      res.json({ 
        tsTicketCount: parseInt(tsResult.rows[0].ts_ticket_count, 10),
        paidBsCount: parseInt(paidResult.rows[0].total_count, 10),
        freeBsCount: parseInt(freeResult.rows[0].total_count, 10)
      });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Failed to fetch ticket counts', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
