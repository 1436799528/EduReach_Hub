import React, { useState } from 'react';
import { 
  Wallet, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShieldCheck, 
  Plus, 
  CreditCard, 
  FileText, 
  Award,
  ChevronRight,
  Send,
  Building2,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { UserProfile, WalletTransaction, ServiceOrder } from '../types';
import { generateOrderWhatsAppSummary } from '../services/storage';

interface WalletAndOrdersModalProps {
  user: UserProfile;
  transactions: WalletTransaction[];
  orders: ServiceOrder[];
  onOpenTopUp: () => void;
  onOpenAPlus: () => void;
  onSelectOrder: (order: ServiceOrder) => void;
}

export const WalletAndOrdersModal: React.FC<WalletAndOrdersModalProps> = ({
  user,
  transactions,
  orders,
  onOpenTopUp,
  onOpenAPlus,
  onSelectOrder
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'transactions'>('orders');

  return (
    <div className="space-y-6">
      
      {/* Wallet Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Main Wallet Card */}
        <div className="md:col-span-2 bg-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-slate-800 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-orange-400" />
                <span>EduReach Student Wallet</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-bold border border-orange-500/30">
                ACTIVE
              </span>
            </div>

            <div className="text-3xl sm:text-4xl font-extrabold text-white mb-1">
              ₦{user.walletBalance.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400">
              Student ID: {user.email} • {user.institutionId}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-6">
            <button
              onClick={onOpenTopUp}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Fund Wallet via Paystack</span>
            </button>
          </div>
        </div>

        {/* A+ Pass Card */}
        <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col justify-between border border-slate-800">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                Semester Pass
              </span>
              <Sparkles className="w-4 h-4 text-orange-400" />
            </div>

            <h3 className="text-lg font-extrabold leading-snug mb-1 text-white">
              {user?.isAPlusSubscriber ? 'A+ Scholar Pass Active' : 'Get A+ Semester Pass'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {user?.isAPlusSubscriber 
                ? 'Unlimited unlocks active across all partner university materials.' 
                : 'Unlock all 15,000+ past questions and summaries for ₦1,500/semester.'}
            </p>
          </div>

          <div className="pt-4">
            {!user?.isAPlusSubscriber && (
              <button
                onClick={onOpenAPlus}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Activate Pass (₦1,500)
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Service Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'transactions'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Wallet Ledger ({transactions.length})
        </button>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
              No orders placed yet.
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-orange-500/40 shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-xs text-slate-900">
                      {order.trackingCode}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {order.targetInstitution}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-50 text-orange-700">
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    {order.serviceType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Placed: {order.createdAt}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">
                      ₦{order.amountPaid.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold">
                      Paid via Wallet
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Transactions Ledger Tab */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No transactions recorded.
              </div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      tx.type === 'TOPUP' || tx.type === 'ROYALTY_EARNED' 
                        ? 'bg-orange-50 text-orange-600' 
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {tx.type === 'TOPUP' || tx.type === 'ROYALTY_EARNED' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 leading-tight">
                        {tx.description}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Ref: {tx.reference} • {tx.date}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`font-bold ${
                      tx.type === 'TOPUP' || tx.type === 'ROYALTY_EARNED' 
                        ? 'text-orange-600' 
                        : 'text-slate-900'
                    }`}>
                      {tx.type === 'TOPUP' || tx.type === 'ROYALTY_EARNED' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                    </span>
                    <span className="block text-[10px] text-slate-400 font-medium">
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};
