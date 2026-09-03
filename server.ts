import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'EduReach Hub', timestamp: new Date().toISOString() });
});

// The previous payment endpoints simulated successful charges, stored balances
// in process memory, exposed webhook logs, and accepted a test signature bypass.
// They are intentionally removed until a real server-side Paystack integration
// backed by persistent database transactions is implemented.
app.all('/api/v1/payments/:action', (_req, res) => {
  res.status(410).json({
    error: 'Payment endpoint unavailable.',
    message: 'Payment processing is not enabled on this server yet.',
  });
});

app.all('/api/v1/users/:userId/balance', (_req, res) => {
  res.status(410).json({
    error: 'Wallet endpoint unavailable.',
    message: 'Wallet balances are not served by the legacy in-memory API.',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduReach Hub server running on port ${PORT}`);
  });
}

startServer();
