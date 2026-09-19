export type NavigationItem = { label: string; href: string; icon: string };

export const primaryNavigation: NavigationItem[] = [
  { label: 'Home', href: '/', icon: '/icons/system/home.svg' },
  { label: 'Services', href: '/services', icon: '/icons/system/dashboard.svg' },
  { label: 'CBT', href: '/cbt', icon: '/icons/system/dashboard.svg' },
  { label: 'News', href: '/news', icon: '/icons/system/notification.svg' },
];

export const accountNavigation: NavigationItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '/icons/system/dashboard.svg' },
  { label: 'Profile', href: '/profile', icon: '/icons/system/profile.svg' },
  { label: 'Settings', href: '/settings', icon: '/icons/system/settings.svg' },
];
