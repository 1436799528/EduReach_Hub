import type { ReactElement } from 'react';
import HubHomePage from '../../pages/HubHomePage';
import AuthPageV2 from '../../pages/AuthPageV2';
import ProfileCompletionPage from '../../pages/ProfileCompletionPage';
import StudentDashboardV2, { type DashboardTab } from '../../pages/StudentDashboardV2';
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
import AdminAnalyticsPage from '../../pages/AdminAnalyticsPage';
import AdminQueuePage from '../../pages/AdminQueuePage';
import AdminCbtPage from '../../pages/AdminCbtPage';
import AdminVouchersPage from '../../pages/AdminVouchersPage';
import AdminUsersPage from '../../pages/AdminUsersPage';
import NotFoundPage from '../../pages/NotFoundPage';
import ExamHubPage from '../../pages/ExamHubPage';
import ProtectedRoute from './ProtectedRoute';

function protectedDashboard(initialTab: DashboardTab = 'dashboard', openSettings = false): ReactElement {
  return (
    <ProtectedRoute>
      <StudentDashboardV2 initialTab={initialTab} openSettings={openSettings} />
    </ProtectedRoute>
  );
}

function protectedProfile(): ReactElement {
  return (
    <ProtectedRoute>
      <ProfileCompletionPage />
    </ProtectedRoute>
  );
}

function protectedCbtResult(attemptId?: string): ReactElement {
  return (
    <ProtectedRoute>
      <CbtResultsPage attemptId={attemptId} />
    </ProtectedRoute>
  );
}

export function renderRoute(pathname: string): ReactElement {
  const path = pathname.replace(/\/$/, '') || '/';

  if (path === '/login' || path === '/signin') return <AuthPageV2 mode="signin" />;
  if (path === '/register' || path === '/signup') return <AuthPageV2 mode="signup" />;
  if (path === '/forgot-password') return <AuthPageV2 mode="forgot" />;
  if (path === '/reset-password') return <AuthPageV2 mode="reset" />;
  if (path === '/verify-email') return <AuthPageV2 mode="verify" />;

  if (path === '/profile/complete' || path === '/profile') return protectedProfile();
  if (path === '/settings') return protectedDashboard('settings', true);

  if (path === '/dashboard') return protectedDashboard('dashboard');
  if (path === '/dashboard/services') return protectedDashboard('services');
  if (path === '/dashboard/applications') return protectedDashboard('applications');
  if (path === '/dashboard/cbt') return protectedDashboard('cbt');
  if (path === '/dashboard/cbt/results') return protectedCbtResult();
  if (path.startsWith('/dashboard/cbt/results/')) {
    return protectedCbtResult(decodeURIComponent(path.slice('/dashboard/cbt/results/'.length)));
  }
  if (path === '/dashboard/past-questions') return protectedDashboard('past-questions');
  if (path === '/dashboard/saved') return protectedDashboard('saved');
  if (path === '/dashboard/scholarships') return protectedDashboard('scholarships');
  if (path === '/dashboard/notifications') return protectedDashboard('notifications');
  if (path === '/dashboard/tools') return protectedDashboard('tools');
  if (path === '/dashboard/profile') return protectedProfile();
  if (path === '/dashboard/settings') return protectedDashboard('settings', true);

  if (path === '/admin') return <AdminDashboardPage />;
  if (path === '/admin/analytics') return <AdminAnalyticsPage />;
  if (path === '/admin/queue') return <AdminQueuePage />;
  if (path === '/admin/cbt') return <AdminCbtPage />;
  if (path === '/admin/vouchers') return <AdminVouchersPage />;
  if (path === '/admin/users') return <AdminUsersPage />;

  if (path === '/') return <HubHomePage />;
  if (path === '/jamb') return <ExamHubPage exam="jamb" />;
  if (path === '/waec') return <ExamHubPage exam="waec" />;
  if (path === '/neco') return <ExamHubPage exam="neco" />;
  if (path === '/post-utme') return <ExamHubPage exam="post-utme" />;
  if (path === '/cbt' || path === '/past-questions') return <CbtPage />;
  if (path === '/cbt/practice') return <CbtPracticePage />;
  if (path === '/cbt/results') return protectedCbtResult();
  if (path === '/screening-calculator' || path === '/calculator' || path === '/admission' || path === '/tools' || path === '/schools') return <ScreeningCalculatorPage />;
  if (path === '/services') return <ServicesCatalogPage />;
  if (path === '/services/track' || path === '/track') return <ServiceTrackPage />;
  if (path === '/nelfund') return <ServiceApplyPage slug="nelfund-loan" />;
  if (path === '/results') return <ServiceApplyPage slug="results" />;
  if (path.startsWith('/services/apply/')) {
    return <ServiceApplyPage slug={decodeURIComponent(path.slice('/services/apply/'.length))} />;
  }
  if (path.startsWith('/services/') && path !== '/services/track') {
    return <ServiceApplyPage slug={decodeURIComponent(path.slice('/services/'.length))} />;
  }
  if (path === '/news' || path === '/events') return <NewsPage />;
  if (path.startsWith('/news/')) {
    return <NewsArticlePage slug={decodeURIComponent(path.slice('/news/'.length))} />;
  }
  if (path === '/jobs' || path === '/scholarships') return <JobsPage />;

  return <NotFoundPage />;
}
