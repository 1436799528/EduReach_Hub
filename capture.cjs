const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/tmp/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  
  // Desktop
  const contextDesk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await contextDesk.newPage();
  
  await page.goto('http://127.0.0.1:3100/');
  await page.screenshot({ path: 'docs/design/ux-9/1-homepage-desktop.png' });
  
  await page.goto('http://127.0.0.1:3100/dashboard');
  await page.screenshot({ path: 'docs/design/ux-9/2-dashboard-desktop.png' });
  
  // click notification
  await page.click('.er-notif-trigger');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/design/ux-9/3-notification-desktop.png' });
  
  await page.screenshot({ path: 'docs/design/ux-9/4-desktop-nav.png', clip: { x:0, y:0, width:1280, height:72 } });
  
  await page.goto('http://127.0.0.1:3100/');
  await page.screenshot({ path: 'docs/design/ux-9/6-desktop-news-cards.png', fullPage: true });

  await page.goto('http://127.0.0.1:3100/dashboard/cbt/results');
  await page.screenshot({ path: 'docs/design/ux-9/8-actions.png' });

  // Mobile
  const contextMob = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const pageMob = await contextMob.newPage();
  
  await pageMob.goto('http://127.0.0.1:3100/');
  await pageMob.screenshot({ path: 'docs/design/ux-9/5-mobile-nav.png' });
  await pageMob.screenshot({ path: 'docs/design/ux-9/7-mobile-news-cards.png', fullPage: true });

  await pageMob.goto('http://127.0.0.1:3100/dashboard');
  await pageMob.hover('.dash-btn'); // button hover
  await pageMob.screenshot({ path: 'docs/design/ux-9/9-interaction-feedback.png' });

  await browser.close();
})();
