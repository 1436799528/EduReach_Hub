import { lazy, useEffect } from 'react';
import type { ReactElement } from 'react';
import HubHomePage from '../../pages/HubHomePage';
import ExamHubPage from '../../pages/ExamHubPage';
import CbtPage from '../../pages/CbtPage';
import NotFoundPage from '../../pages/NotFoundPage';
import ComingSoonPage from '../../pages/ComingSoonPage';
import ProtectedRoute from './ProtectedRoute';
import type { DashboardTab } from '../../pages/StudentDashboardV2';

// Route-level code splitting. The home page, exam hubs and the CBT hall ship in
// the main bundle; everything else is fetched the first time a student opens it,
// so a phone on mobile data never downloads the admin console or the dashboard
// just to read the home page. App.tsx wraps routes in <Suspense>.
const AuthPageV2 = lazy(() => import('../../pages/AuthPageV2'));
const ProfileCompletionPage = lazy(() => import('../../pages/ProfileCompletionPage'));
const StudentDashboardV2 = lazy(() => import('../../pages/StudentDashboardV2'));
const CbtPracticePage = lazy(() => import('../../pages/CbtPracticePage'));
const ExamSetupPage = lazy(() => import('../../pages/ExamSetupPage'));
const PastQuestionsPage = lazy(() => import('../../pages/PastQuestionsPage'));
const CbtResultsPage = lazy(() => import('../../pages/CbtResultsPage'));
const ScreeningCalculatorPage = lazy(() => import('../../pages/ScreeningCalculatorPage'));
const ServicesCatalogPage = lazy(() => import('../../pages/ServicesCatalogPage'));
const SearchPage = lazy(() => import('../../pages/SearchPage'));
const ServiceApplyPage = lazy(() => import('../../pages/ServiceApplyPage'));
const NewsPage = lazy(() => import('../../pages/NewsPage'));
const EventsPage = lazy(() => import('../../pages/EventsPage'));
const NewsArticlePage = lazy(() => import('../../pages/NewsArticlePage'));
const JobsPage = lazy(() => import('../../pages/JobsPage'));
const SchoolFinderPage = lazy(() => import('../../pages/SchoolFinderPage'));
const SchoolDetailsPage = lazy(() => import('../../pages/SchoolDetailsPage'));
const AdminDashboardPage = lazy(() => import('../../pages/AdminDashboardPage'));
const AdminAnalyticsPage = lazy(() => import('../../pages/AdminAnalyticsPage'));
const AdminQueuePage = lazy(() => import('../../pages/AdminQueuePage'));
const AdminCbtPage = lazy(() => import('../../pages/AdminCbtPage'));
const AdminUsersPage = lazy(() => import('../../pages/AdminUsersPage'));
const AdminNewsPage = lazy(() => import('../../pages/AdminNewsPage'));
const AdminContentPage = lazy(() => import('../../pages/AdminContentPage'));
const AdminOpportunitiesPage = lazy(() => import('../../pages/AdminOpportunitiesPage'));
const AdminSchoolsPage = lazy(() => import('../../pages/AdminSchoolsPage'));
const AdminServicesPage = lazy(() => import('../../pages/AdminServicesPage'));
const AdminContentManagerPage = lazy(() => import('../../pages/AdminContentManagerPage'));

// Slugs with a live application workflow. Every other /services/* slug renders
// an honest coming-soon panel instead of a fabricated service form.
const liveServiceSlugs = new Set([
  'nelfund-loan',
  'results',
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
  try { decodeURIComponent(pathname); } catch { return <NotFoundPage />; }
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
  if (path === '/admin/users') return <AdminUsersPage />;
  if (path === '/admin/content') return <AdminContentPage />;
  if (path === '/admin/opportunities') return <AdminOpportunitiesPage />;
  if (path === '/admin/schools') return <AdminSchoolsPage />;
  if (path === '/admin/services') return <AdminServicesPage />;
  if (path === '/admin/content-manager') return <AdminContentManagerPage />;

  if (path === '/') return <HubHomePage />;
  if (path === '/jamb') return <ExamHubPage exam="jamb" />;
  if (path === '/waec') return <ExamHubPage exam="waec" />;
  if (path === '/neco') return <ExamHubPage exam="neco" />;
  if (path === '/post-utme') return <ExamHubPage exam="post-utme" />;
  if (path === '/nabteb') return <ComingSoonPage />;
  if (path === '/past-questions') return <PastQuestionsPage />;
  if (path === '/cbt') return <CbtPage />;
  if (path === '/cbt/practice') return <CbtPracticePage />;
  if (path === '/cbt/setup/jamb') return <ExamSetupPage exam="jamb" />;
  if (path === '/cbt/setup/waec') return <ExamSetupPage exam="waec" />;
  if (path === '/cbt/setup/neco') return <ExamSetupPage exam="neco" />;
  if (path === '/cbt/setup/post-utme') return <ExamSetupPage exam="post-utme" />;
  // Public scorecard route: guests who finish a practice test land here with
  // their locally stored result; signed-in students get the saved attempt.
  if (path === '/cbt/results') return <CbtResultsPage />;
  if (path.startsWith('/cbt/results/')) {
    return <CbtResultsPage attemptId={decodeURIComponent(path.slice('/cbt/results/'.length))} />;
  }
  if (path === '/screening-calculator' || path === '/calculator') return <ScreeningCalculatorPage />;
  if (path === '/admission' || path.startsWith('/admission/')) return <ComingSoonPage />;
  if (path === '/tools' || path.startsWith('/tools/')) return <ComingSoonPage />;
  if (path === '/schools') return <SchoolFinderPage />;
  if (path.startsWith('/schools/')) return <SchoolDetailsPage slug={decodeURIComponent(path.slice('/schools/'.length))} />;
  if (path === '/support') return <ComingSoonPage />;
  if (path === '/services') return <ServicesCatalogPage />;
  if (path === '/search') return <SearchPage />;
  // Request tracking is a signed-in dashboard workflow, not a public page.
  if (path === '/services/track' || path === '/track') return protectedDashboard('services');
  if (path === '/nelfund') return <ServiceApplyPage slug="nelfund-loan" />;
  if (path === '/results') return <ServiceApplyPage slug="results" />;
  if (path.startsWith('/services/apply/')) {
    return serviceEntry(decodeURIComponent(path.slice('/services/apply/'.length)));
  }
  if (path.startsWith('/services/') && path !== '/services/track') {
    return serviceEntry(decodeURIComponent(path.slice('/services/'.length)));
  }
  if (path === '/news') return <NewsPage />;
  if (path === '/events') return <EventsPage />;
  if (path.startsWith('/news/')) {
    return <NewsArticlePage slug={decodeURIComponent(path.slice('/news/'.length))} />;
  }
  if (path === '/jobs' || path === '/scholarships') return <JobsPage />;

  return <NotFoundPage />;
}
