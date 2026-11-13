import { commonInstitutions } from '../data/studentOptions';
import { pastQuestionLibrary, studyMaterialLibrary } from '../data/examPreparation';
import { services } from '../data/services';
import { itemKey } from '../components/dashboard/SchoolFinderCard';
import { simulatorStartHref } from '../components/ExamSimulatorGrid';
import { fetchCbtExams, fetchNews, fetchOpportunities, type NewsItem, type Opportunity } from './api';
import type { CatalogExam } from './cbt-config';

export type SiteSearchItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  href: string;
  identity: string;
};

export type SiteSearchCatalog = {
  items: SiteSearchItem[];
  partialFailure: boolean;
};

function staticResults(exams: CatalogExam[]): SiteSearchItem[] {
  const serviceResults = services.map((service) => ({
    id: `service-${service.key}`,
    title: service.title,
    description: service.description,
    category: service.category,
    href: service.route,
    identity: service.key,
  }));
  const examResults = exams.map((exam) => ({
    id: `exam-${exam.id}`,
    title: exam.title,
    description: exam.description || `Practice ${exam.subject || exam.exam_body} questions.`,
    category: 'CBT Practice',
    href: simulatorStartHref(exam.exam_body, exam.id),
    identity: exam.exam_body,
  }));
  const materialResults = studyMaterialLibrary.map((material) => ({
    id: `material-${material.id}`,
    title: material.title,
    description: `${material.school} · ${material.availability === 'on-request' ? 'document on request' : 'timed practice available'} through EduReach.`,
    category: 'Past questions & materials',
    href: `/past-questions?view=materials&exam=${encodeURIComponent(material.exam)}&q=${encodeURIComponent(material.school)}`,
    identity: material.exam,
  }));
  const bankResults = pastQuestionLibrary.map((record) => ({
    id: `bank-${record.id}`,
    title: record.title,
    description: `${record.school} · ${record.subjects}`,
    category: 'CBT Question Bank',
    href: record.href,
    identity: record.exam,
  }));
  const schoolResults = commonInstitutions
    .filter((name) => !name.startsWith('Other'))
    .map((raw, index) => {
      const match = raw.match(/^(.*?)(?:\s+\(([^)]+)\))?$/);
      const schoolName = match?.[1] || raw;
      const acronym = match?.[2] || '';
      return {
        id: `school-${index + 1}`,
        title: raw,
        description: `${acronym ? `${acronym} · ` : ''}View institution profile in the EduReach School Finder.`,
        category: 'School Finder',
        href: `/schools/${encodeURIComponent(itemKey(schoolName))}?name=${encodeURIComponent(schoolName)}&acronym=${encodeURIComponent(acronym)}`,
        identity: acronym || schoolName,
      };
    });
  return [
    ...serviceResults,
    ...examResults,
    ...materialResults,
    ...bankResults,
    ...schoolResults,
    { id: 'screening-calculator', title: 'Screening Calculator', description: 'Plan an admission aggregate with an institution-specific reminder.', category: 'Student Tool', href: '/screening-calculator', identity: 'calculator' },
    { id: 'cgpa-calculator-tool', title: 'CGPA Calculator', description: 'Calculate your Nigerian 5.0-scale GPA and degree classification.', category: 'Student Tool', href: '/tools/cgpa-calculator', identity: 'calculator' },
    { id: 'opportunities', title: 'Student Opportunities & Grants', description: 'Browse the configured opportunities catalogue and its unavailable states.', category: 'Opportunities', href: '/jobs', identity: 'opportunities' },
    { id: 'news', title: 'News & Updates', description: 'Read verified and clearly labelled student updates.', category: 'Noticeboard', href: '/news', identity: 'news' },
  ];
}

function liveResults(news: NewsItem[], exams: CatalogExam[], opportunities: Opportunity[]): SiteSearchItem[] {
  return [
    ...staticResults(exams),
    ...opportunities.map((item) => ({
      id: `opportunity-${item.id}`,
      title: item.title,
      description: `${item.organisation ? `${item.organisation} · ` : ''}${item.category}${item.deadline ? ` · Deadline ${item.deadline}` : ''}`,
      category: 'Opportunities & Grants',
      href: `/jobs?category=${encodeURIComponent(item.category)}`,
      identity: item.category,
    })),
    ...news.map((item) => ({
      id: `news-${item.id}`,
      title: item.title,
      description: item.summary || item.body.slice(0, 140),
      category: 'News & Updates',
      href: `/news/${encodeURIComponent(item.slug)}`,
      identity: item.category,
    })),
  ];
}

let catalogCache: { expiresAt: number; promise: Promise<SiteSearchCatalog> } | null = null;

/** Search sources are loaded once per short cache window, never per keystroke. */
export function loadSiteSearchCatalog(): Promise<SiteSearchCatalog> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.promise;
  const promise = Promise.allSettled([fetchNews(), fetchCbtExams(), fetchOpportunities()]).then((settled) => {
    const [news, exams, opportunities] = settled;
    return {
      items: liveResults(
        news.status === 'fulfilled' ? news.value : [],
        exams.status === 'fulfilled' ? exams.value : [],
        opportunities.status === 'fulfilled' ? opportunities.value : [],
      ),
      partialFailure: settled.some((entry) => entry.status === 'rejected'),
    };
  });
  catalogCache = { expiresAt: Date.now() + 30_000, promise };
  return promise;
}
