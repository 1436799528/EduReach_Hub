import { useEffect, useState } from 'react';
import { CreditCard, ShieldCheck, X, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';

declare global {
  interface Window {
    PaystackPop?: { setup: (config: Record<string, unknown>) => { openIframe: () => void } };
  }
}

type Props = { isOpen: boolean; onClose: () => void; userEmail: string; onSuccess: (amount: number) => void };
const presets = [1000, 2000, 5000, 10000];

export default function WalletModal({ isOpen, onClose, userEmail, onSuccess }: Props) {
  const [amount, setAmount] = useState(2000);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOpen || document.getElementById('paystack-inline-sdk')) return;
    const script = document.createElement('script');
    script.id = 'paystack-inline-sdk';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);
  }, [isOpen]);

  if (!isOpen) return null;

  const startPayment = () => {
    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
    if (!publicKey) return setMessage('Payment is not configured yet. Add VITE_PAYSTACK_PUBLIC_KEY.');
    if (!window.PaystackPop) return setMessage('Payment gateway is still loading. Please try again.');
    if (!Number.isFinite(amount) || amount < 500) return setMessage('Minimum wallet top-up is ₦500.');

    setProcessing(true);
    setMessage('');
    const reference = `WAL-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: userEmail,
      amount: Math.round(amount * 100),
      currency: 'NGN',
      ref: reference,
      callback: async (response: { reference: string }) => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');
          const result = await fetch('/api/wallet/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ reference: response.reference }),
          });
          const data = await result.json().catch(() => null);
          if (!result.ok || !data?.success) throw new Error(data?.error || 'Payment verification failed.');
          onSuccess(Number(data.amount || amount));
          setMessage(`Wallet funded successfully. New balance: ₦${Number(data.balance || 0).toLocaleString()}`);
          window.setTimeout(onClose, 900);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Payment verification failed.');
        } finally {
          setProcessing(false);
        }
      },
      onClose: () => setProcessing(false),
    });
    handler.openIframe();
  };

  return <div className="wallet-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="wallet-title"><div className="wallet-modal">
    <div className="wallet-modal-head"><div className="wallet-modal-brand"><span><Zap size={15}/></span><div><strong id="wallet-title">Fund Student Wallet</strong><small>Secure wallet top-up</small></div></div><button type="button" className="wallet-close" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
    <div className="wallet-modal-body">
      <label className="wallet-label">Select top-up amount</label>
      <div className="wallet-presets">{presets.map(value => <button key={value} type="button" className={amount===value?'selected':''} onClick={()=>setAmount(value)}>₦{value.toLocaleString()}</button>)}</div>
      <label className="wallet-label" htmlFor="wallet-custom">Or enter custom amount</label>
      <div className="wallet-input-wrap"><span>₦</span><input id="wallet-custom" type="number" min={500} value={amount} onChange={e=>setAmount(Number(e.target.value))}/></div>
      <div className="wallet-security"><ShieldCheck size={18}/><p>Paystack handles payment. EduReach credits the wallet only after server-side verification and duplicate-payment protection.</p></div>
      {message && <div className="wallet-message">{message}</div>}
      <button type="button" className="wallet-pay-btn" disabled={processing || amount < 500} onClick={startPayment}><CreditCard size={17}/>{processing?'Verifying payment…':`Pay ₦${Math.max(0, amount).toLocaleString()} Now`}</button>
    </div>
  </div></div>;
}
