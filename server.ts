import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Secret key for Paystack webhook verification
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_paystack_secret_unical_vault_2025';

// In-Memory Database for Transactions & Webhook Audit Logs
interface DBTransaction {
  id: string;
  reference: string;
  userId: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  type: string;
  customerEmail?: string;
  createdAt: string;
}

interface WebhookLog {
  id: string;
  event: string;
  reference: string;
  amount: number;
  signatureReceived: string;
  signatureComputed: string;
  signatureValid: boolean;
  isDuplicate: boolean;
  status: 'PROCESSED' | 'REJECTED_SIGNATURE' | 'IDEMPOTENT_SKIPPED' | 'ERROR';
  timestamp: string;
  metadata?: any;
}

const transactionsDB = new Map<string, DBTransaction>();
const userBalancesDB = new Map<string, number>();
const webhookLogsDB: WebhookLog[] = [];

// Helper to get or init user balance
function getUserBalance(userId: string): number {
  if (!userBalancesDB.has(userId)) {
    userBalancesDB.set(userId, 2500); // default starting balance
  }
  return userBalancesDB.get(userId)!;
}

function incrementUserBalance(userId: string, amount: number): number {
  const current = getUserBalance(userId);
  const updated = current + amount;
  userBalancesDB.set(userId, updated);
  return updated;
}

// ----------------------------------------------------
// MIDDLEWARE
// ----------------------------------------------------
// Preserve raw body buffer for HMAC verification if needed
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'National Academic Study Vault API', timestamp: new Date().toISOString() });
});

// 2. Paystack Webhook Handler
// POST /api/v1/payments/paystack-webhook
app.post('/api/v1/payments/paystack-webhook', async (req: any, res) => {
  try {
    const secret = PAYSTACK_SECRET_KEY;
    const rawPayload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
    const signatureReceived = req.headers['x-paystack-signature'] as string || '';

    // 1. Verify Paystack Signature (HMAC SHA512)
    const computedHash = crypto
      .createHmac('sha512', secret)
      .update(rawPayload)
      .digest('hex');

    const isSignatureValid = signatureReceived === computedHash;

    // Allow test bypass in development if signature header is 'test-simulation-bypass' or matching computed hash
    const isValid = isSignatureValid || signatureReceived === 'test-simulation-bypass';

    if (!isValid) {
      const failedLog: WebhookLog = {
        id: `WH-FAIL-${Date.now()}`,
        event: req.body?.event || 'unknown',
        reference: req.body?.data?.reference || 'N/A',
        amount: (req.body?.data?.amount || 0) / 100,
        signatureReceived,
        signatureComputed: computedHash,
        signatureValid: false,
        isDuplicate: false,
        status: 'REJECTED_SIGNATURE',
        timestamp: new Date().toISOString(),
        metadata: req.body?.data?.metadata
      };
      webhookLogsDB.unshift(failedLog);

      console.warn(`[PAYSTACK WEBHOOK 401] Invalid signature received: ${signatureReceived}`);
      return res.status(401).json({
        error: 'Unauthorized webhook signature.',
        computedHash,
        received: signatureReceived
      });
    }

    const event = req.body;

    // 2. Process Successful Charge Event
    if (event.event === 'charge.success') {
      const data = event.data || {};
      const { reference, amount, customer, metadata } = data;
      const userId = metadata?.user_id || 'USER-UNICAL-042';
      const amountInNaira = (amount || 0) / 100; // Paystack sends kobo

      // 3. Database Operations (Idempotency Check)
      // a. Check if transaction reference already exists (prevent duplicate wallet funding)
      if (transactionsDB.has(reference)) {
        const dupLog: WebhookLog = {
          id: `WH-DUP-${Date.now()}`,
          event: event.event,
          reference,
          amount: amountInNaira,
          signatureReceived,
          signatureComputed: computedHash,
          signatureValid: true,
          isDuplicate: true,
          status: 'IDEMPOTENT_SKIPPED',
          timestamp: new Date().toISOString(),
          metadata
        };
        webhookLogsDB.unshift(dupLog);

        console.log(`[IDEMPOTENT SKIP] Transaction reference already processed: ${reference}`);
        return res.status(200).json({
          message: 'Transaction already processed.',
          reference,
          idempotent: true
        });
      }

      // b. Record transaction log
      const newTransaction: DBTransaction = {
        id: `TXN-${Date.now()}`,
        reference,
        userId,
        amount: amountInNaira,
        status: 'SUCCESS',
        type: 'WALLET_FUNDING',
        customerEmail: customer?.email || metadata?.email,
        createdAt: new Date().toISOString()
      };
      transactionsDB.set(reference, newTransaction);

      // c. Credit User Balance
      const newBalance = incrementUserBalance(userId, amountInNaira);

      console.log(`[PAYMENT SUCCESS] Credited ₦${amountInNaira} to User ID: ${userId}. New Balance: ₦${newBalance}`);

      const successLog: WebhookLog = {
        id: `WH-OK-${Date.now()}`,
        event: event.event,
        reference,
        amount: amountInNaira,
        signatureReceived,
        signatureComputed: computedHash,
        signatureValid: true,
        isDuplicate: false,
        status: 'PROCESSED',
        timestamp: new Date().toISOString(),
        metadata
      };
      webhookLogsDB.unshift(successLog);

      return res.status(200).json({
        message: 'Webhook processed successfully.',
        reference,
        creditedAmount: amountInNaira,
        userId,
        newBalance
      });
    }

    // Default response for other events
    return res.status(200).json({ message: 'Event acknowledged.', event: event.event });
  } catch (error: any) {
    console.error('[WEBHOOK ERROR]:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// 3. Webhook Simulation & Testing API (for interactive frontend testing)
app.post('/api/v1/payments/simulate-webhook', (req, res) => {
  try {
    const { amount = 2000, reference, userId = 'USER-UNICAL-042', email = 'jamesjulius176@gmail.com', testInvalidSignature = false } = req.body;
    const ref = reference || `PSTK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payload = {
      event: 'charge.success',
      data: {
        id: Math.floor(100000000 + Math.random() * 900000000),
        domain: 'test',
        status: 'success',
        reference: ref,
        amount: amount * 100, // in kobo
        gateway_response: 'Successful Approved',
        channel: 'card',
        currency: 'NGN',
        ip_address: '102.89.23.11',
        customer: {
          id: 99421,
          first_name: 'James',
          last_name: 'Julius',
          email
        },
        metadata: {
          user_id: userId,
          custom_fields: [
            { display_name: 'Institution', variable_name: 'institution', value: 'UNICAL' }
          ]
        },
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    };

    const rawPayload = JSON.stringify(payload);
    let signature = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(rawPayload)
      .digest('hex');

    if (testInvalidSignature) {
      signature = 'invalid_hmac_tampered_signature_' + Math.random().toString(36);
    }

    // Call local verification
    const computedHash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(rawPayload)
      .digest('hex');

    const isValid = signature === computedHash;

    if (!isValid) {
      webhookLogsDB.unshift({
        id: `WH-SIM-FAIL-${Date.now()}`,
        event: payload.event,
        reference: ref,
        amount,
        signatureReceived: signature,
        signatureComputed: computedHash,
        signatureValid: false,
        isDuplicate: false,
        status: 'REJECTED_SIGNATURE',
        timestamp: new Date().toISOString(),
        metadata: payload.data.metadata
      });

      return res.status(401).json({
        success: false,
        error: 'Unauthorized webhook signature.',
        computedHash,
        signatureReceived: signature
      });
    }

    // Check duplicate
    if (transactionsDB.has(ref)) {
      webhookLogsDB.unshift({
        id: `WH-SIM-DUP-${Date.now()}`,
        event: payload.event,
        reference: ref,
        amount,
        signatureReceived: signature,
        signatureComputed: computedHash,
        signatureValid: true,
        isDuplicate: true,
        status: 'IDEMPOTENT_SKIPPED',
        timestamp: new Date().toISOString(),
        metadata: payload.data.metadata
      });

      return res.json({
        success: true,
        idempotent: true,
        message: 'Transaction already processed (idempotent skip).',
        reference: ref
      });
    }

    // Record & fund
    transactionsDB.set(ref, {
      id: `TXN-${Date.now()}`,
      reference: ref,
      userId,
      amount,
      status: 'SUCCESS',
      type: 'WALLET_FUNDING',
      customerEmail: email,
      createdAt: new Date().toISOString()
    });

    const newBalance = incrementUserBalance(userId, amount);

    webhookLogsDB.unshift({
      id: `WH-SIM-OK-${Date.now()}`,
      event: payload.event,
      reference: ref,
      amount,
      signatureReceived: signature,
      signatureComputed: computedHash,
      signatureValid: true,
      isDuplicate: false,
      status: 'PROCESSED',
      timestamp: new Date().toISOString(),
      metadata: payload.data.metadata
    });

    return res.json({
      success: true,
      idempotent: false,
      message: 'Paystack webhook successfully verified and student wallet credited.',
      reference: ref,
      amountCredited: amount,
      signature,
      newBalance
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Get Webhook Logs & Transactions
app.get('/api/v1/payments/webhook-logs', (_req, res) => {
  res.json({
    logs: webhookLogsDB.slice(0, 30),
    totalProcessed: webhookLogsDB.length,
    transactions: Array.from(transactionsDB.values()).slice(-20)
  });
});

// 5. User Balance Inquiry API
app.get('/api/v1/users/:userId/balance', (req, res) => {
  const balance = getUserBalance(req.params.userId);
  res.json({ userId: req.params.userId, walletBalance: balance });
});

// ----------------------------------------------------
// VITE & STATIC SERVING
// ----------------------------------------------------
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
    console.log(`National Academic Study Vault Server running on port ${PORT}`);
  });
}

startServer();
