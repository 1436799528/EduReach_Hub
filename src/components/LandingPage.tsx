import React from 'react';

/** Exact Eduleb architecture reference shell. EduReach routing/content is layered in later. */
export const LandingPage: React.FC = () => (
  <main className="min-h-screen w-full overflow-hidden bg-white">
    <iframe
      title="Eduleb reference landing page"
      src="https://themewagon.github.io/eduleb/index.html"
      className="block h-screen min-h-[1000px] w-full border-0"
      loading="eager"
      allowFullScreen
    />
  </main>
);
