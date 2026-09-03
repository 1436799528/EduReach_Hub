import React, { useEffect } from 'react';
import { X, ShieldCheck, CreditCard, AlertTriangle } from 'lucide-react';

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

/**
 * Payment UI is intentionally non-transactional until a real server-side
 * Paystack initialization + verification flow is configured. This replaces
 * the former local fake-card/fake-transfer implementation which could report
 * successful payments without any gateway transaction.
 */
export const PaystackCheckoutModal: React.FC<PaystackCheckoutProps> = ({
  isOpen,
  title,
  amount,
  userEmail,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="p-5 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Secure Payment</h2>
              <p className="text-[10px] text-slate-500">{userEmail}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment Summary</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900">{title}</p>
              <p className="text-lg font-black text-emerald-700 whitespace-nowrap">₦{amount.toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900">Payment gateway not enabled</p>
              <p className="text-[11px] text-amber-800 leading-relaxed mt-1">
                This checkout cannot charge your card, bank account, or wallet yet. A real Paystack server-side initialization and verification flow must be configured before payments are accepted.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>No payment was attempted or recorded.</span>
          </div>

          <button type="button" onClick={onClose} className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
