import React from 'react';

/** Exact Eduleb reference site shell. Keep the public experience fully Eduleb until the later EduReach integration pass. */
export const LandingPage: React.FC = () => (
  <main className="min-h-screen w-full overflow-hidden bg-white">
    <iframe
      title="Eduleb reference site"
      src="https://themewagon.github.io/eduleb/index.html"
      className="block min-h-screen h-screen w-full border-0"
      loading="eager"
      allowFullScreen
    />
  </main>
);
