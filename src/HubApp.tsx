import type { ReactElement } from 'react';
import HubHomePage from '../pages/HubHomePage';
import CbtPage from '../pages/CbtPage';
import CbtPracticePage from '../pages/CbtPracticePage';
import CbtResultsPage from '../pages/CbtResultsPage';
import ServicesCatalogPage from '../pages/ServicesCatalogPage';
import ServiceApplyPage from '../pages/ServiceApplyPage';
import ServiceTrackPage from '../pages/ServiceTrackPage';
import NewsPage from '../pages/NewsPage';
import NewsArticlePage from '../pages/NewsArticlePage';
import JobsPage from '../pages/JobsPage';

const serviceSlugs = ['nelfund-loan', 'results', 'scratch-cards', 'jamb-slip', 'admission-letters'];

export default function HubApp(): ReactElement {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/') return <HubHomePage />;
  if (path === '/cbt') return <CbtPage />;
  if (path === '/cbt/practice') return <CbtPracticePage />;
  if (path === '/cbt/results') return <CbtResultsPage />;
  if (path === '/services') return <ServicesCatalogPage />;
  if (path === '/services/track') return <ServiceTrackPage />;
  if (path.startsWith('/services/apply/')) return <ServiceApplyPage slug={decodeURIComponent(path.slice('/services/apply/'.length))} />;
  if (serviceSlugs.includes(path.slice('/services/'.length))) return <ServiceApplyPage slug={path.slice('/services/'.length)} />;
  if (path === '/news') return <NewsPage />;
  if (path.startsWith('/news/')) return <NewsArticlePage slug={decodeURIComponent(path.slice('/news/'.length))} />;
  if (path === '/jobs') return <JobsPage />;
  return <HubHomePage />;
}
