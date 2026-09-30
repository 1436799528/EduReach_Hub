import type { TestInfo } from '@playwright/test';

// Shared failure reporting for the browser suite.
//
// GitHub turns `::error` workflow commands into annotations on the check run,
// which is where a reviewer looks first. It matters more here than usual: the
// job log is a zip this project's authoring environment cannot download, and a
// truncated annotation list is worse than none (A11Y-1 was diagnosed twice from
// a list GitHub had silently cut short). So every failing test names itself,
// with the assertion message that identifies it, in one annotation per failure.

/** Emit one check-run annotation for a failed (or timed-out) test. */
export function annotateFailure(testInfo: TestInfo): void {
  if (testInfo.status === testInfo.expectedStatus) return;
  const detail = testInfo.errors
    .map((error) => error.message ?? String(error))
    .join(' | ')
    .replace(/\s+/g, ' ')
    .slice(0, 900);
  const title = `${testInfo.project.name} ${testInfo.title}`.replace(/::/g, ': ').slice(0, 120);
  console.log(`::error title=${title}::${detail}`);
}
