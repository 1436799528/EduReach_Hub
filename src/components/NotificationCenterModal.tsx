import React, { useState } from 'react';
import { 
  X, 
  Bell, 
  CheckCheck, 
  Trash2, 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  Sparkles, 
  DollarSign, 
  ArrowRight,
  Clock
} from 'lucide-react';
import { AppNotification, StudyMaterial } from '../types';

interface NotificationCenterModalProps {
  isOpen?: boolean;
  notifications: AppNotification[];
  materials?: StudyMaterial[];
  onClose: () => void;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification?: (notificationId: string) => void;
  onClearAll: () => void;
  onActionClick: (notification: AppNotification) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen = true,
  notifications,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAll,
  onActionClick,
}) => {
  const [filter, setFilter] = useState<'all' | 'verification' | 'recommendations' | 'orders'>('all');

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'verification') {
      return n.type === 'VERIFICATION_APPROVED' || n.type === 'REVISION_REQUESTED' || n.type === 'VERIFICATION_REJECTED' || n.type === 'SUBMISSION_RECEIVED';
    }
    if (filter === 'recommendations') {
      return n.type === 'RECOMMENDATION_ALERT';
    }
    if (filter === 'orders') {
      return n.type === 'ORDER_UPDATE';
    }
    return true;
  });

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'VERIFICATION_APPROVED':
        return <ShieldCheck className="w-5 h-5 text-emerald-600" />;
      case 'REVISION_REQUESTED':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'VERIFICATION_REJECTED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'RECOMMENDATION_ALERT':
        return <Sparkles className="w-5 h-5 text-indigo-600" />;
      case 'ORDER_UPDATE':
        return <DollarSign className="w-5 h-5 text-orange-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Notification & Alert Center
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[11px] font-extrabold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Service updates, order tracking progress, course recommendations, and academic alerts.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Bulk Action Bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('orders')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filter === 'orders'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Orders & Escrow
            </button>
            <button
              onClick={() => setFilter('recommendations')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filter === 'recommendations'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Course Alerts
            </button>
            <button
              onClick={() => setFilter('verification')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filter === 'verification'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Verification
            </button>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                title="Delete all notifications permanently"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span className="text-red-600 font-bold">Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications Scrollable List */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Bell className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-slate-700">No notifications in this tab</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                All alerts, reminders, and verification notifications have been cleared or read!
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => onMarkAsRead(n.id)}
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 group relative cursor-pointer ${
                  n.isRead
                    ? 'bg-white border-slate-200 hover:bg-slate-50'
                    : 'bg-orange-50/40 border-orange-200 shadow-xs hover:bg-orange-50/70'
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs flex-shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>

                  <div className="space-y-1 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900">
                        {n.title}
                      </h4>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {n.message}
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{n.timestamp}</span>
                      </span>

                      {n.materialCode && (
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {n.materialCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {n.actionLabel && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkAsRead(n.id);
                        onActionClick(n);
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <span>{n.actionLabel}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}

                  {/* Individual Delete/Trash Button */}
                  {onDeleteNotification && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNotification(n.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete this alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Click outside or press Close to return
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
