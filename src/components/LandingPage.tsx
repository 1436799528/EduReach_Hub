import React from 'react';

interface LandingPageProps {
  isLoggedIn?: boolean;
  onNavigateToTab?: (tab: 'feed' | 'my_school' | 'services' | 'profile') => void;
  onNavigate?: (tab: 'feed' | 'my_school' | 'services' | 'profile') => void;
  onOpenAuth?: (mode?: 'login' | 'register', message?: string) => void;
  onGetStarted?: () => void;
  onOpenDemoCBT?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = () => (
  <main className="h-screen w-full overflow-hidden bg-white">
    <iframe
      title="EduReach Hub landing page"
      src="https://themewagon.github.io/eduleb/index.html"
      className="h-full w-full border-0"
      loading="eager"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  </main>
);
