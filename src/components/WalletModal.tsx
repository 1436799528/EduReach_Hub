import { FormEvent, useState } from 'react';

export default function WalletModal({ isOpen, onClose, userEmail, onPending }: { isOpen: boolean; onClose: () => void; userEmail: string; onPending: (amount: number, reference: string) => void }) {
  const [amount, setAmount] = useState(2000);
  const [message, setMessage] = useState('');
  if (!isOpen) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (amount < 500) { setMessage('Minimum top-up is ₦500.'); return; }
    const reference = `WAL-${Date.now()}`;
    setMessage(`Payment request prepared for ${userEmail || 'your account'}.`);
    onPending(amount, reference);
  }

  return <div className="wallet-modal-backdrop" role="dialog" aria-modal="true"><div className="wallet-modal"><div className="wallet-modal-head"><div><small>EduReach Wallet</small><h3>Fund Your Wallet</h3></div><button type="button" onClick={onClose}>×</button></div><form onSubmit={submit}><label>Preset Amount</label><div className="preset-grid">{[1000,2000,5000,10000].map((value) => <button key={value} type="button" className={amount === value ? 'selected' : ''} onClick={() => setAmount(value)}>₦{value.toLocaleString()}</button>)}</div><label>Custom Amount</label><input type="number" min={500} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><div className="wallet-security">✓ Paystack-ready flow. Payment success should be verified server-side before the wallet balance changes.</div><button className="student-btn student-btn-green" type="submit">Continue to Payment</button>{message && <div className="wallet-message">{message}</div>}</form></div></div>;
}
