import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

function getServerSupabase() {
  const url = process.env.VITE_SUPABASE_URL || 'https://gjdfatwcoosyuhakrrhh.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function requireUser(req: express.Request) {
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) throw new Error('Authentication required.');
  const token = auth.slice('Bearer '.length);
  const supabase = getServerSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session.');
  return { supabase, user: data.user };
}

app.post('/api/payments/initialize', async (req, res) => {
  try {
    const { serviceRequestId, amountKobo, email } = req.body as { serviceRequestId?: string; amountKobo?: number; email?: string };
    if (!serviceRequestId || !Number.isInteger(amountKobo) || amountKobo <= 0 || !email) return res.status(400).json({ error: 'serviceRequestId, amountKobo and email are required.' });
    const { supabase, user } = await requireUser(req);
    const { data: request, error: requestError } = await supabase.from('service_requests').select('id,reference_code,status,form_data').eq('id', serviceRequestId).eq('user_id', user.id).single();
    if (requestError || !request) return res.status(404).json({ error: 'Service request not found.' });
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return res.status(503).json({ error: 'PAYSTACK_SECRET_KEY is not configured.' });
    const reference = String(request.reference_code || `ER-${new Date().getFullYear()}-${serviceRequestId.slice(0, 6).toUpperCase()}`);
    const response = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: String(amountKobo), email, currency: 'NGN', reference, metadata: { serviceRequestId, userId: user.id, referenceCode: request.reference_code } }) });
    const payload = await response.json() as any;
    if (!response.ok || !payload?.status) return res.status(502).json({ error: payload?.message || 'Paystack initialization failed.' });
    await supabase.from('service_requests').update({ form_data: { ...(request.form_data || {}), payment_reference: payload.data.reference, payment_amount_kobo: amountKobo, payment_status: 'initialized' } }).eq('id', request.id).eq('user_id', user.id);
    return res.json({ accessCode: payload.data.access_code, reference: payload.data.reference });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : 'Payment initialization failed.' });
  }
});

app.post('/api/payments/verify', async (req, res) => {
  try {
    const { serviceRequestId, reference } = req.body as { serviceRequestId?: string; reference?: string };
    if (!serviceRequestId || !reference) return res.status(400).json({ error: 'serviceRequestId and reference are required.' });
    const { supabase, user } = await requireUser(req);
    const { data: request, error: requestError } = await supabase.from('service_requests').select('id,status,form_data').eq('id', serviceRequestId).eq('user_id', user.id).single();
    if (requestError || !request) return res.status(404).json({ error: 'Service request not found.' });
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return res.status(503).json({ error: 'PAYSTACK_SECRET_KEY is not configured.' });
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
    const payload = await response.json() as any;
    if (!response.ok || !payload?.status) return res.status(502).json({ error: payload?.message || 'Paystack verification failed.' });
    const transaction = payload.data;
    const expectedAmount = Number(request.form_data?.payment_amount_kobo || 0);
    const verified = transaction?.status === 'success' && Number(transaction?.amount) === expectedAmount && transaction?.reference === reference;
    const paymentStatus = verified ? 'paid' : transaction?.status || 'failed';
    const nextStatus = verified ? 'processing' : request.status;
    await supabase.from('service_requests').update({ status: nextStatus, form_data: { ...(request.form_data || {}), payment_reference: reference, payment_status: paymentStatus, payment_gateway_response: transaction?.gateway_response || null } }).eq('id', request.id).eq('user_id', user.id);
    return res.json({ verified, status: paymentStatus, reference });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : 'Payment verification failed.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`EduReach server running on port ${PORT}`));
}

startServer();
