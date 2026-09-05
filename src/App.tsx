import EdulebSite from './EdulebSite';

const routeAliases: Record<string, string> = {
  '/ins_details.html': '/instructor_details.html',
  '/pricing.html': '/pricing_plan.html',
  '/blog_single.html': '/blog_details.html',
};

export default function App() {
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const canonicalPath = routeAliases[currentPath];

  if (canonicalPath) {
    window.history.replaceState(null, '', `${canonicalPath}${window.location.search}`);
  }

  return <EdulebSite />;
}
