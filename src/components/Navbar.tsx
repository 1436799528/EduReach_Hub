import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  Briefcase,
  User,
  MessageSquare,
  Menu,
  X,
  Home,
  Bell,
  Check
} from 'lucide-react';
import { AppNotification, UserProfile } from '../types';
import { listMyNotifications, markNotificationRead } from '../lib/userFeatures';
import { isValidUuid } from '../lib/supabase';

interface NavbarProps {
  currentView: 'landing' | 'feed' | 'my_school' | 'services' | 'profile';
  onNavigate: (view: 'landing' | 'feed' | 'my_school' | 'services' | 'profile') => void;
  user: UserProfile | null;
  onLogout: () => void;
  onSearch: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, user, onLogout, onSearch }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const isLoggedIn = Boolean(user?.id);

  useEffect(() => {
    let mounted = true;
    if (!user?.id || !isValidUuid(user.id)) {
      setNotifications([]);
      return;
    }

    listMyNotifications(user.id)
      .then((items) => {
        if (mounted) setNotifications(items);
      })
      .catch((error) => console.error('Notification load failed', error));

    return () => { mounted = false; };
  }, [user?.id]);

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const handleNotificationRead = async (notificationId: string) => {
    if (!user?.id || !isValidUuid(user.id)) return;
    try {
      await markNotificationRead(user.id, notificationId);
      setNotifications((current) => current.map((notification) =>
        notification.id === notificationId ? { ...notification, isRead: true } : notification
      ));
    } catch (error) {
      console.error('Notification update failed', error);
    }
  };

  const handleNavigation = (id: 'landing' | 'feed' | 'my_school' | 'services' | 'profile') => {
    if (!isLoggedIn && id !== 'landing') {
      onNavigate('landing');
      setMobileMenuOpen(false);
      return;
    }
    onNavigate(id);
    setMobileMenuOpen(false);
    setNotificationOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems = [
    { id: isLoggedIn ? 'feed' : 'landing', label: isLoggedIn ? 'Campus Feed' : 'Home', icon: isLoggedIn ? GraduationCap : Home },
    { id: 'my_school', label: 'My School', icon: BookOpen },
    { id: 'services', label: 'Campus Services', icon: Briefcase },
    { id: 'profile', label: 'Profile', icon: User }
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl shadow-[0_3px_18px_rgba(15,23,42,0.05)]">
      <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between min-h-16 gap-2 sm:gap-4">
          <button onClick={() => handleNavigation(isLoggedIn ? 'feed' : 'landing')} className="flex items-center gap-2.5 text-left cursor-pointer group min-w-0">
            <div className="er-cta w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight truncate">EduReach</span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-800 shrink-0">HUB</span>
              </div>
              <p className="hidden lg:block text-[9px] text-slate-500 font-semibold truncate">Past Questions, Notes & Campus Services</p>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button key={item.id} onClick={() => handleNavigation(item.id)} className={`relative px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
                  {isActive && <span className="absolute left-2 right-2 -bottom-0.5 h-0.5 rounded-full bg-orange-500" />}
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {isLoggedIn && user && (
              <div className="relative">
                <button type="button" onClick={() => setNotificationOpen((open) => !open)} className="er-cta relative p-2 sm:p-2.5 rounded-xl text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer" aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}>
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-orange-600 text-white text-[9px] font-bold flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
                {notificationOpen && (
                  <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-1.5rem))] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <div><p className="text-xs font-bold text-slate-900">Notifications</p><p className="text-[10px] text-slate-500">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</p></div>
                      <Bell className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center"><Bell className="w-6 h-6 mx-auto text-slate-300" /><p className="text-xs font-semibold text-slate-600 mt-2">No notifications yet</p></div>
                      ) : notifications.slice(0, 20).map((notification) => (
                        <button key={notification.id} type="button" onClick={() => handleNotificationRead(notification.id)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${notification.isRead ? 'bg-white' : 'bg-orange-50/50'}`}>
                          <div className="flex items-start gap-2.5">
                            <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${notification.isRead ? 'bg-slate-100 text-slate-500' : 'bg-orange-100 text-orange-700'}`}>{notification.isRead ? <Check className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}</div>
                            <div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-800 line-clamp-1">{notification.title}</p><p className="text-[11px] text-slate-600 leading-relaxed mt-0.5 line-clamp-2">{notification.message}</p><p className="text-[9px] text-slate-400 mt-1">{new Date(notification.timestamp).toLocaleString()}</p></div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isLoggedIn && user && (
              <button onClick={() => handleNavigation('profile')} className="er-cta flex items-center gap-2 p-1 sm:p-1.5 sm:pl-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer max-w-[8.5rem] sm:max-w-none">
                <img src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'} alt={user.name} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-orange-400 shrink-0" referrerPolicy="no-referrer" />
                <div className="text-left hidden sm:block pr-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight truncate max-w-[88px]">{user.name.split(' ')[0]}</p>
                  <span className="text-[9px] text-orange-600 font-bold block">{user.institutionId}</span>
                </div>
              </button>
            )}

            <button onClick={() => setMobileMenuOpen((open) => !open)} className="md:hidden er-cta p-2.5 rounded-xl bg-slate-900 text-white cursor-pointer" aria-label="Toggle Menu">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-xl px-3 py-3 space-y-2 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return <button key={item.id} onClick={() => handleNavigation(item.id)} className={`w-full px-3 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100'}`}><Icon className="w-4 h-4" /><span>{item.label}</span></button>;
            })}
          </div>
          {isLoggedIn && <button onClick={onLogout} className="w-full py-3 rounded-xl border border-slate-200 bg-white text-rose-600 text-xs font-bold cursor-pointer">Sign Out</button>}
        </div>
      )}
    </header>
  );
};
