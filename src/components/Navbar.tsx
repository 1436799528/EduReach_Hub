import React, { useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  Briefcase,
  User,
  MessageSquare,
  Menu,
  X,
  Home,
  LogIn,
  Phone
} from 'lucide-react';
import { UserProfile, InstitutionId } from '../types';
import { INSTITUTIONS } from '../data/mockData';

interface NavbarProps {
  currentView: 'landing' | 'feed' | 'my_school' | 'services' | 'profile';
  setCurrentView: (view: 'landing' | 'feed' | 'my_school' | 'services' | 'profile') => void;
  user: UserProfile | null;
  isLoggedIn: boolean;
  selectedInstitution: InstitutionId;
  setSelectedInstitution: (id: InstitutionId) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  user,
  isLoggedIn,
  selectedInstitution,
  setSelectedInstitution,
  onOpenAuth,
  onLogout
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: isLoggedIn ? 'feed' : 'landing', label: 'Home', icon: Home },
    { id: 'my_school', label: 'My School', icon: BookOpen },
    { id: 'services', label: 'Campus Services', icon: Briefcase },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  const handleNavigation = (id: string) => {
    if (!isLoggedIn && id !== 'landing') {
      onOpenAuth('register');
      setMobileMenuOpen(false);
      return;
    }
    setCurrentView(id as 'landing' | 'feed' | 'my_school' | 'services' | 'profile');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNavigation(isLoggedIn ? 'feed' : 'landing')}
              className="flex items-center gap-2.5 text-left cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-xs group-hover:bg-orange-700 transition-colors">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">EduReach</span>
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">HUB</span>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold hidden sm:block">Academic Vault & Campus Liaison</p>
              </div>
            </button>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold" title="Moderator Support Desk">
              <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <MessageSquare className="w-2.5 h-2.5" />
              </div>
              <span>Moderator Desk</span>
            </div>

            {isLoggedIn && user ? (
              <button
                onClick={() => handleNavigation('profile')}
                className="flex items-center gap-2 p-1.5 pl-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 transition-colors cursor-pointer"
              >
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
                  alt={user.name}
                  className="w-6 h-6 rounded-full object-cover border border-orange-500"
                  referrerPolicy="no-referrer"
                />
                <div className="text-left hidden lg:block pr-1">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight truncate max-w-[100px]">{user.name.split(' ')[0]}</p>
                  <span className="text-[9px] text-orange-600 font-bold block">{user.institutionId}</span>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => onOpenAuth('login')} className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                  Sign In
                </button>
                <button onClick={() => onOpenAuth('register')} className="px-3.5 py-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer">
                  Register Free
                </button>
              </div>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white p-4 space-y-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.id)}
                  className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Moderator Support Desk</span>
            </div>

            {!isLoggedIn && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={() => { onOpenAuth('login'); setMobileMenuOpen(false); }} className="py-2.5 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold text-center">
                  Sign In
                </button>
                <button onClick={() => { onOpenAuth('register'); setMobileMenuOpen(false); }} className="py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold text-center shadow-xs">
                  Register Free
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
