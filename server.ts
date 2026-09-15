import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
app.disable('x-powered-by');

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

function validPaystackSignature(rawBody: Buffer, signature: string, secret: string) {
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const actual = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

async function sendWhatsAppOrderCompletion(payload: { recipientPhone: string; studentName: string; orderReference: string; serviceTitle: string; pinDetails?: { serial: string; pin: string } }) {
  const endpoint = process.env.WHATSAPP_API_ENDPOINT;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!endpoint || !token) return false;
  let phone = payload.recipientPhone.replace(/\D/g, '');
  if (phone.startsWith('0')) phone = `234${phone.slice(1)}`;
  let message = `EduReach Hub Order Completed!\n\nHello ${payload.studentName},\nYour request for ${payload.serviceTitle} (Ref: ${payload.orderReference}) has been successfully processed.\n\n`;
  if (payload.pinDetails) message += `Scratch Card Details:\nSerial: ${payload.pinDetails.serial}\nPIN: ${payload.pinDetails.pin}\n\n`;
  message += 'Track your portal requests from your EduReach account.';
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token, to: phone, body: message }) });
    return response.ok;
  } catch (error) {
    console.error('WhatsApp notification failed:', error);
    return false;
  }
}

app.post('/api/webhooks/paystack', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const signature = req.header('x-paystack-signature');
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret || !signature) return res.status(400).json({ error: 'Missing security headers' });
    if (!validPaystackSignature(rawBody, signature, secret)) return res.status(401).json({ error: 'Invalid Paystack signature' });
    const event = JSON.parse(rawBody.toString('utf8')) as any;
    if (event.event !== 'charge.success') return res.status(200).json({ status: 'ignored' });

    const reference = event?.data?.reference;
    const serviceRequestId = event?.data?.metadata?.serviceRequestId;
    const supabase = getServerSupabase();
    const query = serviceRequestId
      ? supabase.from('service_requests').select('id,reference_code,status,form_data,amount,user_id,service_catalog(title)').eq('id', serviceRequestId).single()
      : supabase.from('service_requests').select('id,reference_code,status,form_data,amount,user_id,service_catalog(title)').eq('reference_code', reference).single();
    const { data: request, error } = await query;
    if (error || !request) return res.status(404).json({ error: 'Service request not found' });
    if (request.status === 'completed') return res.status(200).json({ status: 'already_processed' });

    const expectedKobo = Math.round(Number(request.amount || 0) * 100);
    if (Number(event?.data?.amount) !== expectedKobo) return res.status(400).json({ error: 'Payment amount mismatch' });

    const body = { ...(request.form_data || {}), payment_reference: reference, payment_status: 'paid', payment_gateway_response: event.data.gateway_response || null };
    let nextStatus = 'processing';
    let pinDetails: { serial: string; pin: string } | undefined;
    const serviceTitle = request.service_catalog?.title || 'EduReach service';

    if (serviceTitle === 'WAEC / NECO Scratch Cards') {
      const examBody = String(request.form_data?.exam_body || '').toUpperCase();
      if (examBody === 'WAEC' || examBody === 'NECO') {
        const { data: vouchers } = await supabase.rpc('claim_service_voucher', { p_request_id: request.id, p_exam_body: examBody });
        const voucher = vouchers?.[0];
        if (voucher) {
          pinDetails = { serial: voucher.serial_number, pin: voucher.pin };
          nextStatus = 'completed';
          body.voucher_serial = voucher.serial_number;
          body.voucher_pin = voucher.pin;
        }
      }
    }

    await supabase.from('service_requests').update({ status: nextStatus, form_data: body }).eq('id', request.id);

    const { data: profile } = await supabase.from('profiles').select('full_name,phone').eq('id', request.user_id).maybeSingle();
    if (profile?.phone && nextStatus === 'completed') {
      await sendWhatsAppOrderCompletion({ recipientPhone: profile.phone, studentName: profile.full_name || 'Student', orderReference: request.reference_code || reference, serviceTitle, pinDetails });
    }
    return res.status(200).json({ status: 'success', service_status: nextStatus });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.use(express.json({ limit: '1mb' }));

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
    await supabase.from('service_requests').update({ amount: Number(amountKobo) / 100, form_data: { ...(request.form_data || {}), payment_reference: payload.data.reference, payment_amount_kobo: amountKobo, payment_status: 'initialized' } }).eq('id', request.id).eq('user_id', user.id);
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
    await supabase.from('service_requests').update({ status: verified ? 'processing' : request.status, form_data: { ...(request.form_data || {}), payment_reference: reference, payment_status: paymentStatus, payment_gateway_response: transaction?.gateway_response || null } }).eq('id', request.id).eq('user_id', user.id);
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
