import { useEffect, useState } from 'react';
import { loadSiteContent, peekSiteContent, type LoadedSiteContent } from '../lib/siteContent';
import { mergeSiteContent, type SiteContentPayload } from '../lib/siteContentModel';

const fallbackContent: SiteContentPayload = mergeSiteContent(null);

/**
 * The site content for the current page: cached, merged over the shipped copy,
 * and safe to call from several components on the same screen.
 */
export function useSiteContent(): LoadedSiteContent {
  const [state, setState] = useState<LoadedSiteContent>(
    () => peekSiteContent() ?? { content: fallbackContent, source: 'fallback', fetchedAt: null },
  );

  useEffect(() => {
    let active = true;
    void loadSiteContent().then((loaded) => {
      if (active) setState(loaded);
    });
    return () => { active = false; };
  }, []);

  return state;
}
