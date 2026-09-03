import React, { useEffect } from 'react';
import { ShieldCheck, X, Lock, AlertTriangle } from 'lucide-react';
import { UserProfile } from '../types';

interface PaystackWebhookInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfile;
  onWalletUpdated?: (newBalance: number) => void;
  onSimulateSuccess?: (reference: string, amount: number, itemType: any, metadata?: any) => void;
}

export const PaystackWebhookInspectorModal: React.FC<PaystackWebhookInspectorModalProps> = ({ isOpen, onClose }) => {
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
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Payment Webhook Inspector</h2>
              <p className="text-[10px] text-slate-500">Legacy simulator disabled</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900">Test payment simulation has been disabled</p>
              <p className="text-[11px] text-amber-800 leading-relaxed mt-1">
                This panel previously generated fake Paystack charges, balances, webhook logs, and successful-payment responses. Those behaviors are disabled until a real server-side gateway integration with persistent transactions is available.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Current payment safety state</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
              <span className="rounded-xl bg-white border border-slate-200 px-3 py-2">No fake card processing</span>
              <span className="rounded-xl bg-white border border-slate-200 px-3 py-2">No simulated wallet credits</span>
              <span className="rounded-xl bg-white border border-slate-200 px-3 py-2">No public webhook logs</span>
            </div>
          </div>

          <button type="button" onClick={onClose} className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
