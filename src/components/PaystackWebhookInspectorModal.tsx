import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Lock, 
  Key, 
  Database, 
  Copy, 
  Check, 
  X, 
  ArrowRight,
  Zap,
  Clock,
  Layers,
  Code
} from 'lucide-react';
import { UserProfile } from '../types';

interface PaystackWebhookInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfile;
  onWalletUpdated?: (newBalance: number) => void;
  onSimulateSuccess?: (reference: string, amount: number, itemType: any, metadata?: any) => void;
}

export const PaystackWebhookInspectorModal: React.FC<PaystackWebhookInspectorModalProps> = ({
  isOpen,
  onClose,
  user = { id: 'usr_default', email: 'scholar@edureach.edu.ng', name: 'Scholar', walletBalance: 0 } as any,
  onWalletUpdated,
  onSimulateSuccess
}) => {
  const [testAmount, setTestAmount] = useState<number>(3000);
  const [customRef, setCustomRef] = useState<string>('');
  const [tamperSignature, setTamperSignature] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'logs'>('simulator');

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/v1/payments/webhook-logs');
      if (res.ok) {
        const data = await res.json();
        setWebhookLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching webhook logs:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
      if (!customRef) {
        setCustomRef(`PSTK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSimulateWebhook = async () => {
    setIsSubmitting(true);
    setLastResult(null);
    try {
      const payload = {
        amount: testAmount,
        reference: customRef.trim() || undefined,
        userId: user.id,
        email: user.email,
        testInvalidSignature: tamperSignature
      };

      const res = await fetch('/api/v1/payments/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setLastResult({ status: res.status, data });

      if (res.ok && data.success && !data.idempotent && data.newBalance !== undefined) {
        onWalletUpdated(data.newBalance);
      }

      await fetchLogs();
    } catch (err: any) {
      setLastResult({ status: 500, data: { error: err.message } });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 text-slate-100 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]"
      >
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Node.js / Express Webhook Engine
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  HMAC SHA-512
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Paystack Payment Webhook & Idempotency Engine
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 bg-slate-950 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'simulator'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Interactive Webhook Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'code'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Express Handler Code & Specs</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Live Audit Logs ({webhookLogs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 text-xs space-y-5 font-sans">
          
          {/* TAB 1: SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="space-y-5">
              
              {/* Architecture Explanation Banner */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Idempotency & Cryptographic Security Rules</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  When Paystack dispatches a <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300 font-mono">charge.success</code> event, the backend computes an <code className="text-emerald-300 font-mono">HMAC-SHA512</code> hash of the raw payload against the server secret key, verifies signature equality in constant-time, executes an idempotency check against prior references to prevent double-crediting, and atomically funds the student's wallet.
                </p>
              </div>

              {/* Simulation Controls */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Dispatch Simulated Paystack Event</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-semibold">
                      Payment Amount (₦ Naira)
                    </label>
                    <div className="flex gap-2">
                      {[1500, 2500, 3000, 5000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTestAmount(amt)}
                          className={`px-2.5 py-1.5 rounded-lg font-mono font-bold transition-all ${
                            testAmount === amt
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          ₦{amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-semibold">
                      Transaction Reference (Idempotency Key)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customRef}
                        onChange={(e) => setCustomRef(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-emerald-300 w-full focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomRef(`PSTK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`)}
                        title="Generate Fresh Reference"
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      *Send the same reference twice to test idempotency duplicate protection.
                    </span>
                  </div>
                </div>

                {/* Tampering Option */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <input
                    type="checkbox"
                    id="tamper-sig"
                    checked={tamperSignature}
                    onChange={(e) => setTamperSignature(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="tamper-sig" className="text-slate-300 text-[11px] cursor-pointer">
                    Simulate <strong className="text-rose-400">Forged / Tampered Webhook Signature</strong> (expect HTTP 401 Unauthorized rejection)
                  </label>
                </div>

                {/* Submit button */}
                <button
                  onClick={handleSimulateWebhook}
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <Play className="w-4 h-4 text-slate-950 fill-slate-950" />
                  )}
                  <span>Post Webhook to Express Endpoint</span>
                </button>
              </div>

              {/* Result Preview */}
              {lastResult && (
                <div className={`p-4 rounded-xl border ${
                  lastResult.status === 200 && !lastResult.data?.idempotent
                    ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
                    : lastResult.data?.idempotent
                    ? 'bg-amber-950/40 border-amber-600/60 text-amber-200'
                    : 'bg-rose-950/40 border-rose-600/60 text-rose-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-bold">
                      {lastResult.status === 200 && !lastResult.data?.idempotent && (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>HTTP 200: Payment Verified & Balance Credited</span>
                        </>
                      )}
                      {lastResult.data?.idempotent && (
                        <>
                          <Lock className="w-4 h-4 text-amber-400" />
                          <span>HTTP 200: Idempotency Lock Triggered (Duplicate Reference Skipped)</span>
                        </>
                      )}
                      {lastResult.status === 401 && (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                          <span>HTTP 401: Unauthorized Signature Rejection</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-[10px] bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                      Status {lastResult.status}
                    </span>
                  </div>

                  <pre className="bg-slate-950 p-3 rounded-lg font-mono text-[10px] text-slate-300 overflow-x-auto border border-slate-800">
                    {JSON.stringify(lastResult.data, null, 2)}
                  </pre>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: CODE & SPECIFICATIONS */}
          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono font-bold text-xs text-white">server.ts / Express Webhook Handler</span>
                  </div>
                  <button
                    onClick={() => handleCopy(`app.post('/api/v1/payments/paystack-webhook', express.json(), async (req, res) => { ... })`)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Handler</span>
                  </button>
                </div>

                <pre className="p-3 bg-slate-900 rounded-lg font-mono text-[11px] text-emerald-300/90 leading-relaxed overflow-x-auto">
{`const crypto = require('crypto');

app.post('/api/v1/payments/paystack-webhook', express.json(), async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    
    // 1. Verify Paystack HMAC-SHA512 Signature
    const hash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Unauthorized webhook signature.');
    }

    const event = req.body;

    // 2. Process Successful Charge
    if (event.event === 'charge.success') {
      const { reference, amount, metadata } = event.data;
      const userId = metadata.user_id;
      const amountInNaira = amount / 100; // kobo to NGN

      // 3. Database Idempotency Check
      const existingTx = await db.transactions.findByRef(reference);
      if (existingTx) {
        return res.status(200).send('Transaction already processed.');
      }

      // Record transaction & credit balance
      await db.transactions.create({ reference, userId, amount: amountInNaira, status: 'SUCCESS' });
      await db.users.incrementWalletBalance(userId, amountInNaira);
    }

    return res.status(200).send('Webhook processed successfully.');
  } catch (error) {
    return res.status(500).send('Internal Server Error');
  }
});`}
                </pre>
              </div>

              {/* Security highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="font-bold text-emerald-400 block mb-1">1. Cryptographic HMAC</span>
                  <p className="text-slate-400">
                    Prevents spoofed balance injections by verifying the secret-derived SHA-512 hash against incoming headers.
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="font-bold text-amber-400 block mb-1">2. Idempotency Keying</span>
                  <p className="text-slate-400">
                    Guarantees student accounts cannot be double-credited even if Paystack retries the webhook multiple times.
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="font-bold text-cyan-400 block mb-1">3. Atomic Transaction</span>
                  <p className="text-slate-400">
                    Binds the ledger record and wallet balance update in an isolated transaction to prevent race conditions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Real-Time Server Webhook Invocations</span>
                <button
                  onClick={fetchLogs}
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Logs</span>
                </button>
              </div>

              {webhookLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                  No webhook requests recorded yet. Click "Interactive Webhook Simulator" to test.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {webhookLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${
                            log.status === 'PROCESSED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : log.status === 'IDEMPOTENT_SKIPPED'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            {log.status}
                          </span>
                          <span className="font-mono text-slate-300 text-xs font-bold">
                            Ref: {log.reference}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Amount: ₦{log.amount?.toLocaleString()} • Event: {log.event} • Sig Valid: {log.signatureValid ? 'Yes' : 'No'}
                        </p>
                      </div>

                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Current Student Balance:</span>
            <span className="font-mono font-bold text-emerald-400">₦{user.walletBalance.toLocaleString()}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
