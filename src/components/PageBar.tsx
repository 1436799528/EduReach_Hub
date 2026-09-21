import { ArrowLeft, Home } from 'lucide-react';
import { useEffect, useState } from 'react';
import { pageTitleFor } from '../lib/pageMeta';

/**
 * Global return-navigation bar rendered under the header on every public
 * portal page (hidden on the home page, which has nowhere to return to).
 * Back uses real browser history and falls back to Home for deep links.
 */
export default function PageBar() {
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/$/, '') || '/');

  useEffect(() => {
    const sync = () => setPath(window.location.pathname.replace(/\/$/, '') || '/');
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  if (path === '/') return null;

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="er-pagebar">
      <div className="er-pagebar-row">
        <button type="button" className="er-pagebar-back" onClick={goBack}>
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        <span className="er-pagebar-title">{pageTitleFor(path)}</span>
        <a className="er-pagebar-home" href="/">
          <Home size={14} />
          <span>Home</span>
        </a>
      </div>
    </div>
  );
}
