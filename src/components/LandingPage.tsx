import React from 'react';

/**
 * Temporary exact-reference shell for the Eduleb design phase.
 * Routing, branding, and EduReach-specific content will be layered in later.
 */
export const LandingPage: React.FC = () => (
  <main className="min-h-screen w-full overflow-hidden bg-white">
    <iframe
      title="Eduleb reference landing page"
      src="https://themewagon.github.io/eduleb/index.html"
      className="block h-screen min-h-[900px] w-full border-0"
      loading="eager"
      allowFullScreen
    />
  </main>
);
