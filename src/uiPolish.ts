const platformLinks = {
  telegram: import.meta.env.VITE_EDUREACH_TELEGRAM_URL || 'https://t.me/',
  whatsapp: import.meta.env.VITE_EDUREACH_WHATSAPP_URL || 'https://wa.me/',
  youtube: import.meta.env.VITE_EDUREACH_YOUTUBE_URL || 'https://youtube.com/',
  x: import.meta.env.VITE_EDUREACH_X_URL || 'https://x.com/',
};

function go(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function textOf(el: Element) {
  return (el.textContent || '').trim().replace(/\s+/g, ' ');
}

function setLabel(el: Element, label: string) {
  const current = textOf(el);
  if (current === label || el.getAttribute('data-ui-polished-label') === label) return;
  el.setAttribute('data-ui-polished-label', label);
  el.textContent = label;
}

function contextualAction(title: string, type: string, path: string) {
  const lower = title.toLowerCase();
  if (path === '/cbt' || type === 'CBT' || lower.includes('cbt')) return 'Start Test';
  if (type === 'News' || path === '/news' || path.startsWith('/news/')) return 'Read Story';
  if (type === 'Scholarship' || type === 'Jobs' || type === 'Study Abroad' || path === '/opportunities' || path.startsWith('/opportunities/')) return 'View Opportunity';
  if (path === '/services') {
    if (lower.includes('result')) return 'Check Result';
    if (lower.includes('scratch') || lower.includes('card')) return 'Buy Card';
    if (lower.includes('slip')) return 'Print Slip';
    return 'Apply Now';
  }
  return 'Open';
}

function rewriteActions() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.utility-card .utility-footer .primary.full').forEach((el, index) => {
    const labels = ['Start Test', 'Apply Now', 'Read Story', 'View Opportunity'];
    setLabel(el, labels[index] || 'Open');
  });

  document.querySelectorAll('.results-grid .card').forEach((card) => {
    const link = card.querySelector('.card-link');
    if (!link) return;
    const badge = card.querySelector('.badge');
    const type = textOf(badge || document.createElement('span'));
    const title = textOf(card.querySelector('h3') || document.createElement('h3'));
    setLabel(link, contextualAction(title, type, path));
  });

  document.querySelectorAll('.mini-service-grid .card').forEach((card) => {
    const title = textOf(card.querySelector('h3') || document.createElement('h3')).toLowerCase();
    const labels = title.includes('result') ? 'Check Result' : title.includes('scratch') ? 'Buy Card' : title.includes('slip') ? 'Print Slip' : 'Apply Now';
    card.setAttribute('data-service-action', labels);
  });

  document.querySelectorAll('.card-link').forEach((el) => {
    const label = textOf(el);
    if (label === 'Read') setLabel(el, 'Read Story');
    if (label === 'View opportunity') setLabel(el, 'View Opportunity');
    if (label === 'Start') setLabel(el, path === '/cbt' ? 'Start Test' : 'Practice Now');
    if (label === 'Open result') {
      const card = el.closest('.card');
      const badge = textOf(card?.querySelector('.badge') || document.createElement('span'));
      const title = textOf(card?.querySelector('h3') || document.createElement('h3'));
      setLabel(el, contextualAction(title, badge, path));
    }
  });
}

function polishNavigation() {
  document.querySelectorAll('nav button, .top-actions button, .footer button').forEach((button) => {
    const label = textOf(button);
    if (label === 'CBT Practice') setLabel(button.querySelector('span') || button, 'CBT');
    if (label === 'Opportunities') setLabel(button.querySelector('span') || button, 'Jobs');
    if (label === 'Study Groups') {
      const target = button as HTMLButtonElement & { __edureachRewired?: boolean };
      setLabel(button.querySelector('span') || button, 'Community');
      if (!target.__edureachRewired) {
        target.__edureachRewired = true;
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          go('/community');
        }, true);
      }
    }
  });

  document.querySelectorAll('.top-actions .icon-btn').forEach((button) => {
    const target = button as HTMLButtonElement & { __edureachNotificationRewired?: boolean };
    if (target.__edureachNotificationRewired) return;
    target.__edureachNotificationRewired = true;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      go('/dashboard/notifications');
    }, true);
  });
}

function ensureSocialBar() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const shouldShow = path === '/community' || path === '/groups';
  document.body.classList.toggle('edureach-community-polish', shouldShow);
  if (!shouldShow) {
    document.querySelector('.social-community-bar')?.remove();
    return;
  }
  if (path === '/groups') {
    go('/community');
    return;
  }
  if (document.querySelector('.social-community-bar')) return;

  const bar = document.createElement('section');
  bar.className = 'social-community-bar';
  bar.innerHTML = `
    <div class="social-community-inner">
      <div class="social-community-intro">
        <span class="eyebrow">CHANNELS &amp; SOCIAL</span>
        <h2>Stay connected outside EduReach.</h2>
        <p>Use the channels for fast alerts, practice drops, video guides and status updates.</p>
      </div>
      <div class="social-community-grid">
        <a class="social-community-card telegram" href="${platformLinks.telegram}" target="_blank" rel="noreferrer"><strong>Telegram Channel</strong><span>Join for instant JAMB &amp; NELFUND alerts</span><b>Join Channel</b></a>
        <a class="social-community-card whatsapp" href="${platformLinks.whatsapp}" target="_blank" rel="noreferrer"><strong>WhatsApp Community</strong><span>Get daily past questions on WhatsApp</span><b>Join Group</b></a>
        <a class="social-community-card video" href="${platformLinks.youtube}" target="_blank" rel="noreferrer"><strong>YouTube</strong><span>Watch video guides &amp; walkthroughs</span><b>Follow Us</b></a>
        <a class="social-community-card x" href="${platformLinks.x}" target="_blank" rel="noreferrer"><strong>X / Twitter</strong><span>Get quick status updates and alerts</span><b>Follow Us</b></a>
      </div>
    </div>`;

  document.querySelector('.footer')?.before(bar);
}

function applyUiPolish() {
  rewriteActions();
  polishNavigation();
  ensureSocialBar();
}

let scheduled = 0;
function schedule() {
  window.clearTimeout(scheduled);
  scheduled = window.setTimeout(applyUiPolish, 0);
}

export function initUiPolish() {
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  schedule();
}
