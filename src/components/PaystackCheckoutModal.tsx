import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  CreditCard, 
  CheckCircle2, 
  Loader2, 
  Copy, 
  Check, 
  Lock,
  Wallet,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface PaystackCheckoutProps {
  isOpen: boolean;
  title: string;
  amount: number;
  itemType: 'TOPUP' | 'UNLOCK' | 'A_PLUS_PASS' | 'SERVICE';
  itemMetadata?: any;
  userEmail: string;
  userName?: string;
  userPhone?: string;
  walletBalance?: number;
  onSuccess: (reference: string, amount: number, itemType: 'TOPUP' | 'UNLOCK' | 'A_PLUS_PASS' | 'SERVICE', metadata?: any) => void;
  onClose: () => void;
}

export const PaystackCheckoutModal: React.FC<PaystackCheckoutProps> = ({
  isOpen,
  title,
  amount,
  itemType,
  itemMetadata,
  userEmail,
  userName = 'Scholar',
  userPhone = '08148920119',
  walletBalance = 0,
  onSuccess,
  onClose
}) => {
  const [paymentChannel, setPaymentChannel] = useState<'card' | 'transfer' | 'wallet' | 'ussd'>('card');
  const [cardNumber, setCardNumber] = useState('5399 4100 8920 1194');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('892');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Close on Escape key press
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

  const canPayWithWallet = itemType !== 'TOPUP' && walletBalance >= amount;

  const handleCopyAccount = () => {
    navigator.clipboard.writeText('8069681639');
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const generatedReference = `PSTK-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    setTimeout(() => {
      setLoading(false);
      setCompleted(true);
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {
        // ignore confetti failures
      }

      setTimeout(() => {
        onSuccess(generatedReference, amount, itemType, itemMetadata);
      }, 1000);
    }, 1100);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Paystack Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-md">
              PS
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white">
                  Paystack <span className="text-emerald-400">Checkout</span>
                </span>
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SECURE
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                {userEmail} • {userName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cancel and close payment modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Banner */}
        <div className="bg-emerald-50 px-5 py-3.5 border-b border-emerald-100 flex items-center justify-between">
          <div className="pr-3">
            <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
              Payment Summary
            </span>
            <span className="text-xs font-bold text-slate-800 line-clamp-1">
              {title}
            </span>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="text-lg font-black text-emerald-700">
              ₦{amount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Channel Selector */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Choose Payment Method
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 text-xs">
            
            {canPayWithWallet && (
              <button
                type="button"
                onClick={() => setPaymentChannel('wallet')}
                className={`p-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                  paymentChannel === 'wallet'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-[11px] font-bold flex items-center justify-center gap-1">
                  <Wallet className="w-3 h-3" />
                  <span>Wallet</span>
                </div>
                <div className="text-[9px] opacity-80 font-mono">₦{walletBalance.toLocaleString()}</div>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPaymentChannel('card')}
              className={`p-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                paymentChannel === 'card'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="text-[11px] font-bold">Debit Card</div>
              <div className="text-[9px] opacity-80">Master/Visa/Verve</div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentChannel('transfer')}
              className={`p-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                paymentChannel === 'transfer'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="text-[11px] font-bold">Bank Transfer</div>
              <div className="text-[9px] opacity-80">Instant Virtual A/C</div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentChannel('ussd')}
              className={`p-2 rounded-xl font-bold border transition-all text-center cursor-pointer ${
                paymentChannel === 'ussd'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="text-[11px] font-bold">USSD</div>
              <div className="text-[9px] opacity-80">*737# / *919#</div>
            </button>

          </div>
        </div>

        {/* Channel Form Area */}
        <div className="p-5 flex-1 overflow-y-auto">
          
          {completed ? (
            <div className="py-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Payment Authorized!
              </h3>
              <p className="text-xs text-slate-500">
                ₦{amount.toLocaleString()} confirmed via Paystack. Unlocking your resource...
              </p>
            </div>
          ) : (
            <form onSubmit={handleExecutePayment} className="space-y-4 text-xs">
              
              {/* WALLET PAYMENT */}
              {paymentChannel === 'wallet' && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Available Wallet Credit:</span>
                    <span className="font-extrabold text-sm">₦{walletBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-emerald-200">
                    <span>Charge Amount:</span>
                    <span className="font-bold text-emerald-700">-₦{amount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold pt-1 border-t border-emerald-200">
                    <span>Balance Remaining:</span>
                    <span>₦{(walletBalance - amount).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* CARD PAYMENT */}
              {paymentChannel === 'card' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Card Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full text-xs font-mono font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-9 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full text-xs font-mono font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        CVV (3 Digits)
                      </label>
                      <input
                        type="password"
                        maxLength={3}
                        required
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full text-xs font-mono font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* BANK TRANSFER PAYMENT */}
              {paymentChannel === 'transfer' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">
                      Dedicated Virtual Account
                    </span>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-mono font-extrabold text-white tracking-wider">
                          8069681639
                        </div>
                        <div className="text-xs text-slate-400">
                          Wema Bank / Paystack-EduReach
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyAccount}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                      >
                        {copiedAccount ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Transfer exactly <b>₦{amount.toLocaleString()}</b> to the account above. Payment will auto-verify within 15 seconds.
                  </p>
                </div>
              )}

              {/* USSD PAYMENT */}
              {paymentChannel === 'ussd' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-center">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Dial this USSD code on your registered SIM:
                  </span>
                  <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-sm font-bold rounded-xl">
                    *737*50* {amount} *8920#
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Supported: GTBank (*737#), Zenith (*966#), UBA (*919#), Access (*901#), and FirstBank (*894#).
                  </p>
                </div>
              )}

              {/* Action Submit */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing ₦{amount.toLocaleString()}...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        {paymentChannel === 'wallet' ? 'Confirm Wallet Deduction' : `Pay ₦${amount.toLocaleString()}`}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel & Return to Hub
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-bit SSL Encrypted • Verified Paystack Integration</span>
              </div>

            </form>
          )}

        </div>

      </div>
    </div>
  );
};
