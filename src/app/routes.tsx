import type { ReactElement } from 'react';
import HubHomePage from '../../pages/HubHomePage';
import AuthPageV2 from '../../pages/AuthPageV2';
import ProfileCompletionPage from '../../pages/ProfileCompletionPage';
import StudentDashboardV2 from '../../pages/StudentDashboardV2';
import CbtPage from '../../pages/CbtPage';
import CbtPracticePage from '../../pages/CbtPracticePage';
import CbtResultsPage from '../../pages/CbtResultsPage';
import ScreeningCalculatorPage from '../../pages/ScreeningCalculatorPage';
import ServicesCatalogPage from '../../pages/ServicesCatalogPage';
import ServiceApplyPage from '../../pages/ServiceApplyPage';
import ServiceTrackPage from '../../pages/ServiceTrackPage';
import NewsPage from '../../pages/NewsPage';
import NewsArticlePage from '../../pages/NewsArticlePage';
import JobsPage from '../../pages/JobsPage';
import AdminDashboardPage from '../../pages/AdminDashboardPage';
import AdminQueuePage from '../../pages/AdminQueuePage';
import AdminCbtPage from '../../pages/AdminCbtPage';
import AdminVouchersPage from '../../pages/AdminVouchersPage';
import AdminUsersPage from '../../pages/AdminUsersPage';
import NotFoundPage from '../../pages/NotFoundPage';

export function renderRoute(pathname: string): ReactElement {
  const path = pathname.replace(/\/$/, '') || '/';

  if (path === '/login' || path === '/signin') return <AuthPageV2 mode="signin" />;
  if (path === '/register' || path === '/signup') return <AuthPageV2 mode="signup" />;
  if (path === '/forgot-password') return <AuthPageV2 mode="forgot" />;
  if (path === '/reset-password') return <AuthPageV2 mode="reset" />;
  if (path === '/verify-email') return <AuthPageV2 mode="verify" />;
  if (path === '/profile/complete' || path === '/profile') return <ProfileCompletionPage />;
  if (path === '/dashboard') return <StudentDashboardV2 />;

  if (path === '/admin') return <AdminDashboardPage />;
  if (path === '/admin/queue') return <AdminQueuePage />;
  if (path === '/admin/cbt') return <AdminCbtPage />;
  if (path === '/admin/vouchers') return <AdminVouchersPage />;
  if (path === '/admin/users') return <AdminUsersPage />;

  if (path === '/') return <HubHomePage />;
  if (path === '/cbt') return <CbtPage />;
  if (path === '/cbt/practice') return <CbtPracticePage />;
  if (path === '/cbt/results') return <CbtResultsPage />;
  if (path === '/screening-calculator' || path === '/calculator') return <ScreeningCalculatorPage />;
  if (path === '/services') return <ServicesCatalogPage />;
  if (path === '/services/track' || path === '/track') return <ServiceTrackPage />;
  if (path.startsWith('/services/apply/')) {
    return <ServiceApplyPage slug={decodeURIComponent(path.slice('/services/apply/'.length))} />;
  }
  if (path.startsWith('/services/') && path !== '/services/track') {
    return <ServiceApplyPage slug={decodeURIComponent(path.slice('/services/'.length))} />;
  }
  if (path === '/news') return <NewsPage />;
  if (path.startsWith('/news/')) {
    return <NewsArticlePage slug={decodeURIComponent(path.slice('/news/'.length))} />;
  }
  if (path === '/jobs') return <JobsPage />;

  return <NotFoundPage />;
}
