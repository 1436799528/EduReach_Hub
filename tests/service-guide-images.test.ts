import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serviceGuides } from '../src/data/serviceGuides';

// Provenance rules (owner, 2026-10-21): genuine portal screenshots or clearly
// labelled placeholders only. No generated mockups presented as screenshots,
// no generic campus/graduation/CBT-centre photos beside portal instructions.
test('every guide step image exists locally (no hotlinks)', () => {
  for (const guide of Object.values(serviceGuides)) {
    for (const step of guide.steps) {
      assert.ok(step.image.startsWith('/'), `${guide.slug}/${step.title} must be a local asset`);
      assert.ok(existsSync(join(process.cwd(), 'public', step.image)), `${guide.slug}: ${step.image}`);
      assert.ok(step.imageAlt.length > 10, `${guide.slug}: meaningful alt for ${step.title}`);
      assert.ok(['screenshot', 'official-document', 'illustration', 'photo', 'placeholder'].includes(step.imageKind));
      assert.ok(step.imageSource.length > 5, `${guide.slug}/${step.title} source label`);
    }
  }
});
test('no mismatched stock photos, no duplicates inside a guide', () => {
  const banned = ['/news/photos/waec-result.png', '/news/photos/graduates.jpg', '/news/photos/campus.jpg', '/news/photos/jamb-cbt.jpg', '/news/photos/step-online-application.webp'];
  for (const guide of Object.values(serviceGuides)) {
    const images = guide.steps.map((s) => s.image);
    assert.equal(new Set(images).size, images.length, `${guide.slug} repeats an image`);
    for (const b of banned) assert.ok(!images.includes(b), `${guide.slug} uses banned ${b}`);
  }
});
test('screenshots name their source site; placeholders say pending verification', () => {
  for (const guide of Object.values(serviceGuides)) {
    for (const step of guide.steps) {
      if (step.imageKind === 'screenshot') assert.match(step.imageSource, /via |Portal screenshot/, step.title);
      if (step.imageKind === 'placeholder') assert.match(step.imageSource, /pending verification/i, step.title);
      if (step.imageKind === 'official-document') assert.equal(step.image, '/news/photos/nelfund.webp');
    }
  }
});
test('WAEC and NECO are separate sequences with their verified fields', () => {
  const steps = serviceGuides['results'].steps;
  assert.equal(steps.filter((s) => s.section?.startsWith('WAEC')).length, 4);
  assert.equal(steps.filter((s) => s.section?.startsWith('NECO')).length, 4);
  assert.match(steps[1].body, /Serial No/);
  assert.match(steps[6].body, /Token/);
  assert.match(steps[7].title, /Check my result/);
});
test('NELFUND steps follow the verified portal registration flow', () => {
  const body = serviceGuides['nelfund-loan'].steps.map((s) => `${s.title} ${s.body}`).join(' ');
  assert.match(body, /Get Started/);
  assert.match(body, /verify your educational information/i);
  assert.match(body, /student status with JAMB/i);
});
test('guide UI labels Portal screenshot and Placeholder beside each step', () => {
  const page = readFileSync(new URL('../pages/ServiceApplyPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /Portal screenshot/);
  assert.match(page, /Placeholder/);
  assert.match(page, /<figcaption[^>]*>\{guideStep\.imageSource\}<\/figcaption>/);
});
