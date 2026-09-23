import { useEffect } from 'react';
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
import AdminNewsPage from '../../pages/AdminNewsPage';
import NotFoundPage from '../../pages/NotFoundPage';
import ExamHubPage from '../../pages/ExamHubPage';
import ComingSoonPage from '../../pages/ComingSoonPage';
import ProtectedRoute from './ProtectedRoute';

// Slugs with a live application workflow. Every other /services/* slug renders
// an honest coming-soon panel instead of a fabricated service form.
const liveServiceSlugs = new Set([
  'nelfund-loan',
  'results',
  'scratch-cards',
  'jamb-slip',
  'admission-letters',
]);

function serviceEntry(slug: string): ReactElement {
  const normalized = slug.toLowerCase();
  if (liveServiceSlugs.has(normalized)) return <ServiceApplyPage slug={normalized} />;
  return <ComingSoonPage />;
}

function protectedDashboard(initialTab: DashboardTab = 'dashboard', openSettings = false): ReactElement {
  return (
    <ProtectedRoute>
      <StudentDashboardV2 initialTab={initialTab} openSettings={openSettings} />
    </ProtectedRoute>
  );
}

function RedirectTo({ path }: { path: string }): ReactElement {
  useEffect(() => {
    window.history.replaceState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [path]);
  return <></>;
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

  if (path === '/profile/complete' || path === '/profile' || path === '/dashboard/profile') return protectedProfile();
  if (path === '/settings' || path === '/dashboard/settings') return protectedDashboard('dashboard', true);

  // Four dashboard pages: Overview · My Requests · My CBT · Tools & Saved.
  if (path === '/dashboard' || path === '/dashboard/notifications') return protectedDashboard('dashboard');
  if (path === '/dashboard/services' || path === '/dashboard/applications') return protectedDashboard('services');
  if (path === '/dashboard/cbt' || path === '/dashboard/past-questions') return protectedDashboard('cbt');
  if (path === '/dashboard/cbt/results') return protectedCbtResult();
  if (path.startsWith('/dashboard/cbt/results/')) {
    return protectedCbtResult(decodeURIComponent(path.slice('/dashboard/cbt/results/'.length)));
  }
  if (path === '/dashboard/tools' || path === '/dashboard/saved') return protectedDashboard('tools');
  if (path === '/dashboard/scholarships') return <RedirectTo path="/jobs" />;

  if (path === '/admin') return <AdminDashboardPage />;
  if (path === '/admin/analytics') return <AdminAnalyticsPage />;
  if (path === '/admin/queue') return <AdminQueuePage />;
  if (path === '/admin/cbt') return <AdminCbtPage />;
  if (path === '/admin/news') return <AdminNewsPage />;
  if (path === '/admin/vouchers') return <AdminVouchersPage />;
  if (path === '/admin/users') return <AdminUsersPage />;

  if (path === '/') return <HubHomePage />;
  if (path === '/jamb') return <ExamHubPage exam="jamb" />;
  if (path === '/waec') return <ExamHubPage exam="waec" />;
  if (path === '/neco') return <ExamHubPage exam="neco" />;
  if (path === '/post-utme') return <ExamHubPage exam="post-utme" />;
  if (path === '/nabteb') return <ComingSoonPage />;
  if (path === '/cbt' || path === '/past-questions') return <CbtPage />;
  if (path === '/cbt/practice') return <CbtPracticePage />;
  // Public scorecard route: guests who finish a practice test land here with
  // their locally stored result; signed-in students get the saved attempt.
  if (path === '/cbt/results') return <CbtResultsPage />;
  if (path.startsWith('/cbt/results/')) {
    return <CbtResultsPage attemptId={decodeURIComponent(path.slice('/cbt/results/'.length))} />;
  }
  if (path === '/screening-calculator' || path === '/calculator') return <ScreeningCalculatorPage />;
  if (path === '/admission' || path.startsWith('/admission/')) return <ComingSoonPage />;
  if (path === '/tools' || path.startsWith('/tools/')) return <ComingSoonPage />;
  if (path === '/schools') return <ComingSoonPage />;
  if (path === '/support') return <ComingSoonPage />;
  if (path === '/services') return <ServicesCatalogPage />;
  if (path === '/services/track' || path === '/track') return <ServiceTrackPage />;
  if (path === '/nelfund') return <ServiceApplyPage slug="nelfund-loan" />;
  if (path === '/results') return <ServiceApplyPage slug="results" />;
  if (path.startsWith('/services/apply/')) {
    return serviceEntry(decodeURIComponent(path.slice('/services/apply/'.length)));
  }
  if (path.startsWith('/services/') && path !== '/services/track') {
    return serviceEntry(decodeURIComponent(path.slice('/services/'.length)));
  }
  if (path === '/news' || path === '/events') return <NewsPage />;
  if (path.startsWith('/news/')) {
    return <NewsArticlePage slug={decodeURIComponent(path.slice('/news/'.length))} />;
  }
  if (path === '/jobs' || path === '/scholarships') return <JobsPage />;

  return <NotFoundPage />;
}
