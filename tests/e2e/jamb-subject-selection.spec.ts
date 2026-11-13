import { expect, test, type Page } from '@playwright/test';

const jambId = 'jamb-ui-test-bank';
const jambSubjects = [
  { subject: 'Use of English', questionCount: 60 },
  { subject: 'Mathematics', questionCount: 40 },
  { subject: 'Physics', questionCount: 40 },
  { subject: 'Chemistry', questionCount: 40 },
  { subject: 'Biology', questionCount: 40 },
  { subject: 'Government', questionCount: 40 },
  { subject: 'Literature in English', questionCount: 40 },
  { subject: 'French', questionCount: 40 },
];

async function mockJambBank(page: Page, englishQuestions = 60) {
  await page.route('**/api/cbt/exams', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      items: [{
        id: jambId,
        title: 'JAMB UTME Practice Bank',
        exam_body: 'JAMB',
        subject: 'Multiple subjects',
        description: 'Offline UI fixture',
        duration_minutes: 90,
        question_count: jambSubjects.reduce((total, item) => total + item.questionCount, 0) - 60 + englishQuestions,
        subject_count: jambSubjects.length,
        subjects: jambSubjects.map((item) => ({
          subject: item.subject,
          questionCount: item.subject === 'Use of English' ? englishQuestions : item.questionCount,
        })),
      }],
    }),
  }));
  await page.route(`**/api/cbt/exams/${jambId}/subjects`, (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      exam: {
        id: jambId,
        title: 'JAMB UTME Practice Bank',
        examBody: 'JAMB',
        subject: 'Multiple subjects',
        description: 'Offline UI fixture',
        defaultDurationMinutes: 90,
      },
      subjects: jambSubjects.map((item) => ({
        ...item,
        questionCount: item.subject === 'Use of English' ? englishQuestions : item.questionCount,
      })),
      totalQuestions: jambSubjects.reduce((total, item) => total + item.questionCount, 0) - 60 + englishQuestions,
      limits: { minQuestions: 5, maxQuestions: 100, minMinutes: 5, maxMinutes: 240, maxSubjects: 9 },
      mock: { questionCount: 100, subjectQuota: { english: 20, other: 20 }, durationMinutes: 90 },
      rules: { compulsorySubjects: ['Use of English'], compulsoryMissing: englishQuestions < 60, minSubjects: 1, maxSubjects: 4 },
    }),
  }));
  await page.route('http://127.0.0.1:54321/**', (route) => {
    if (new URL(route.request().url()).pathname === '/rest/v1/cbt_subject_catalog') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          { subject_name: 'Mathematics', subject_group: 'Science' },
          { subject_name: 'Physics', subject_group: 'Science' },
          { subject_name: 'Chemistry', subject_group: 'Science' },
          { subject_name: 'Biology', subject_group: 'Science' },
          { subject_name: 'Government', subject_group: 'Arts' },
          { subject_name: 'Literature in English', subject_group: 'Arts' },
          { subject_name: 'French', subject_group: 'Arts' },
        ]),
      });
    }
    return route.abort();
  });
}

test('JAMB subject selection keeps English locked and uses a group-filtered dropdown', async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_JAMB_UI !== '1', 'Run with the isolated mocked JAMB UI build.');
  await mockJambBank(page);
  await page.goto('/cbt/setup/jamb');

  await expect(page.getByRole('heading', { name: 'How this CBT session works' })).toBeVisible();
  const groupSelect = page.getByRole('combobox', { name: 'Choose subject group' });
  await expect(groupSelect).toHaveValue('Science');
  await expect(groupSelect.getByRole('option')).toHaveCount(3);
  await expect(groupSelect.getByRole('option', { name: 'Science' })).toHaveCount(1);
  await expect(groupSelect.getByRole('option', { name: 'Commercial' })).toHaveCount(1);
  await expect(groupSelect.getByRole('option', { name: 'Arts' })).toHaveCount(1);
  await expect(page.getByRole('list', { name: 'Selected subjects' })).toContainText('Use of English · compulsory');
  await expect(page.getByRole('button', { name: 'Remove Use of English' })).toHaveCount(0);

  const subjectSelect = page.getByRole('combobox', { name: 'Add an optional JAMB subject' });
  await expect(subjectSelect.getByRole('option', { name: 'Mathematics', exact: true })).toHaveCount(1);
  await expect(subjectSelect.getByRole('option', { name: 'Physics', exact: true })).toHaveCount(1);
  await expect(subjectSelect.getByRole('option', { name: 'French', exact: true })).toHaveCount(0);
  await subjectSelect.selectOption({ label: 'Physics' });
  await expect(page.getByText('2 of 4 selected')).toBeVisible();
  await expect(subjectSelect.locator('option')).not.toContainText(['Physics']);

  await groupSelect.selectOption('Arts');
  await expect(page.getByRole('list', { name: 'Selected subjects' })).toContainText('Use of English · compulsory');
  await expect(page.getByRole('list', { name: 'Selected subjects' })).toContainText('Physics');
  await expect(subjectSelect.getByRole('option', { name: 'French', exact: true })).toHaveCount(1);
  await expect(subjectSelect.getByRole('option', { name: 'Government', exact: true })).toHaveCount(1);
  await expect(subjectSelect.getByRole('option', { name: 'Physics', exact: true })).toHaveCount(0);

  await subjectSelect.selectOption({ label: 'French' });
  await groupSelect.selectOption('Science');
  await subjectSelect.selectOption({ label: 'Mathematics' });
  await expect(page.getByText('4 of 4 selected')).toBeVisible();
  await expect(subjectSelect).toBeDisabled();

  await page.getByRole('button', { name: 'Remove French' }).click();
  await expect(subjectSelect).toBeEnabled();
  await subjectSelect.selectOption({ label: 'Biology' });
  await expect(page.getByText('4 of 4 selected')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Selected subjects' })).toContainText('Use of English · compulsory');
});

test('JAMB full mock advertises the fixed 180/120 format and names a short pool', async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_JAMB_UI !== '1', 'Run with the isolated mocked JAMB UI build.');
  await mockJambBank(page, 59);
  await page.goto('/cbt/setup/jamb');
  const subjectSelect = page.getByRole('combobox', { name: 'Add an optional JAMB subject' });
  await subjectSelect.selectOption({ label: 'Mathematics' });
  await subjectSelect.selectOption({ label: 'Physics' });
  await subjectSelect.selectOption({ label: 'Chemistry' });
  await page.getByRole('radio', { name: 'Mock examination' }).click();

  await expect(page.getByText(/180 questions in 120 minutes/)).toBeVisible();
  await expect(page.getByText(/Use of English needs 60 but the bank has 59/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start mock examination' })).toBeDisabled();
});
