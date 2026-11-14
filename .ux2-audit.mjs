import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3100';
const OUT = 'test-results/ux2';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/tmp/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-setuid-sandbox'],
});
const capabilities = [
  'profile.read','profile.update','dashboard.access','settings.read','settings.update','service_request.create','service_request.read_own','cbt.attempt','cbt.view_result',
  'news.read','news.create','news.update','news.publish','news.delete','opportunity.read','opportunity.create','opportunity.update','opportunity.delete',
  'institution.read','institution.create','institution.update','institution.delete','calendar.read','calendar.create','calendar.update','calendar.delete',
  'service.read','service.create','service.update','service.delete','service_request.read','service_request.process','cbt.read','cbt.manage',
  'analytics.read','audit.read','data.read','data.write','data.import','site.read','site.update','user.read','user.suspend','user.manage_roles',
];

const users = [
  { id:'u1', full_name:'Aponi James', email:'aponi@example.test', matric_number:'190404001', school:'University of Lagos', faculty:'Science', department:'Computer Science', level:'300', role:'student', suspended:false, created_at:'2025-09-01T10:00:00Z' },
  { id:'u2', full_name:'Chidera Okafor', email:'chidera@example.test', matric_number:'200201044', school:'University of Nigeria, Nsukka', faculty:'Arts', department:'Mass Communication', level:'200', role:'student', suspended:true, created_at:'2025-10-12T10:00:00Z' },
  { id:'u3', full_name:'Fatima Bello', email:'fatima@example.test', matric_number:'180303002', school:'Ahmadu Bello University', faculty:'Science', department:'Biology', level:'400', role:'student', suspended:false, created_at:'2024-11-02T10:00:00Z' },
  { id:'u4', full_name:'Test Operator', email:'operator@example.test', matric_number:'', school:'', faculty:'', department:'', level:'', role:'super_admin', suspended:false, created_at:'2024-01-02T10:00:00Z' },
];
const requests = [
  { id:'r1', user_id:'u1', status:'submitted', reference_code:'ER-8F2K19', form_data:{ fullName:'Aponi James', message:'Please help me confirm my NELFUND application status.', serviceTitle:'NELFUND Loan Support' }, created_at:'2026-11-14T08:20:00Z', updated_at:'2026-11-14T08:20:00Z', service_catalog:{ title:'NELFUND Loan Support' } },
  { id:'r2', user_id:'u2', status:'reviewing', reference_code:'ER-7A1M03', form_data:{ fullName:'Chidera Okafor', requestDetails:'JAMB slip for 2024 UTME.' }, created_at:'2026-11-13T16:05:00Z', updated_at:'2026-11-13T17:00:00Z', service_catalog:{ title:'JAMB Result Slip' } },
  { id:'r3', user_id:'u3', status:'awaiting_information', reference_code:'ER-3C9P88', form_data:{ fullName:'Fatima Bello', message:'Admission letter for 2025/2026.' }, created_at:'2026-11-12T09:10:00Z', updated_at:'2026-11-12T12:30:00Z', admin_note:'Awaiting matric number.', service_catalog:{ title:'Admission Letter' } },
  { id:'r4', user_id:'u1', status:'completed', reference_code:'ER-1B4Z77', form_data:{ fullName:'Aponi James', message:'Result checker.' }, created_at:'2026-11-08T11:00:00Z', updated_at:'2026-11-09T09:00:00Z', service_catalog:{ title:'WAEC Result Checker' } },
];
const news = [
  { id:'n1', title:'JAMB 2026 UTME registration opens', slug:'jamb-2026-utme-registration-opens', category:'exams', category_slug:'exams', published:true, featured:true, is_placeholder:false, published_at:'2026-11-12T08:00:00Z', updated_at:'2026-11-12T08:00:00Z' },
  { id:'n2', title:'NELFUND opens second loan window', slug:'nelfund-second-loan-window', category:'funding', category_slug:'funding', published:true, featured:false, is_placeholder:false, published_at:'2026-11-10T08:00:00Z', updated_at:'2026-11-10T08:00:00Z' },
  { id:'n3', title:'Post-UTME dates for 2026 admissions', slug:'post-utme-dates-2026', category:'admissions', category_slug:'admissions', published:false, featured:false, is_placeholder:true, placeholder_note:'Confirm dates with each institution.', published_at:null, updated_at:'2026-11-09T08:00:00Z' },
];
const analytics = {
  metrics:{ pending_requests:3, service_requests:128, users:2410, admins:4, events_24h:1840, sessions_24h:612, events_7d:12400, completed_requests:98, rejected_requests:27, cbt_attempts:860, cbt_submitted:742, average_cbt_score:63.4, published_news:46, institutions:214, active_services:4 },
  activity:{ topPages:[{path:'/cbt',views:420},{path:'/dashboard',views:310},{path:'/services',views:205}], searches:188, zeroResultSearches:12, serviceSubmits:[{path:'/services/nelfund-loan',count:18}], serviceViews:[{path:'/services/nelfund-loan',views:90},{path:'/services/jamb-slip',views:64}], cbtStarts:[{exam:'JAMB UTME',count:96}], eventsTotal:12400, since:'2026-11-07T00:00:00Z' },
  audit:[{ id:'a1', action:'request.status_changed', created_at:'2026-11-14T09:00:00Z', actor_email:'operator@example.test', target:'ER-7A1M03' },{ id:'a2', action:'news.published', created_at:'2026-11-13T15:00:00Z', actor_email:'editor@example.test', target:'JAMB 2026 UTME registration opens' }],
  recentRequests: requests.slice(0,3), recentUsers: users.slice(0,3),
};

async function mockAdmin(page) {
  await page.addInitScript(() => {
    localStorage.setItem('edureach-privacy-preferences-v1', JSON.stringify({ necessary:true, analytics:false, savedAt:new Date().toISOString(), version:1 }));
    localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({
      access_token:'isolated-test-token', refresh_token:'isolated-test-refresh',
      expires_at: Math.floor(Date.now()/1000)+3600, expires_in:3600, token_type:'bearer',
      user:{ id:'isolated-test-user', aud:'authenticated', email:'operator@example.test', app_metadata:{}, user_metadata:{} },
    }));
  });
  await page.route('**/edureach-unconfigured.supabase.co/**', (route) => route.abort());
  await page.route('**/api/admin/session', (route) => route.fulfill({ json:{ user:{ id:'isolated-test-user', email:'operator@example.test', fullName:'Test Operator', role:'super_admin', capabilities } } }));
  await page.route('**/api/admin/analytics', (route) => route.fulfill({ json: analytics }));
  await page.route('**/api/admin/jobs', (route) => route.fulfill({ json:{
    sinceHours:24,
    jobs:[
      { job_name:'analytics-retention', runs:24, last_success_at:'2026-11-14T08:00:00Z', last_failure_at:null, failures:0, last_error:null, fresh:true },
      { job_name:'exam-reminders', runs:24, last_success_at:'2026-11-14T07:30:00Z', last_failure_at:null, failures:0, last_error:null, fresh:true },
    ],
    health:{ ok:true, missing:[], stale:[], failing:[] },
  } }));
  await page.route(/\/api\/admin\/service-requests(\?.*)?$/, (route) => route.fulfill({ json:{ items: requests } }));
  await page.route(/\/api\/admin\/users(\?.*)?$/, (route) => route.fulfill({ json:{ items: users } }));
  await page.route(/\/api\/admin\/news(\?.*)?$/, (route) => route.fulfill({ json:{ items: news, page:1, hasMore:false } }));
  await page.route('**/api/admin/services', (route) => route.fulfill({ json:{ items:[
    { id:'s1', service_key:'nelfund-loan', title:'NELFUND Loan Support', description:'Federal loan application help.', category:'Funding', application_url:'', route:'/services/nelfund-loan', sort_order:10, active:true, is_form_service:true },
    { id:'s2', service_key:'jamb-slip', title:'JAMB Result Slip', description:'Result slip assistance.', category:'Exams', application_url:'', route:'/services/jamb-slip', sort_order:20, active:true, is_form_service:true },
  ] } }));
  await page.route('**/api/admin/schools*', (route) => route.fulfill({ json:{ items:[
    { id:'i1', school_name:'University of Lagos', acronym:'UNILAG', slug:'university-of-lagos', state:'Lagos', institution_type:'Federal University', website_url:'https://unilag.edu.ng', post_utme_available:true, post_utme_method:'cbt', post_utme_verified:true, is_verified:true },
    { id:'i2', school_name:'University of Nigeria, Nsukka', acronym:'UNN', slug:'university-of-nigeria-nsukka', state:'Enugu', institution_type:'Federal University', website_url:'https://unn.edu.ng', post_utme_available:true, post_utme_method:'cbt', post_utme_verified:true, is_verified:true },
  ] } }));
  await page.route('**/api/admin/opportunities*', (route) => route.fulfill({ json:{ items:[
    { id:'o1', title:'NNPC/Total Scholarship 2026', organisation:'TotalEnergies', category:'scholarship', deadline:'2026-12-15', is_active:true, updated_at:'2026-11-10T08:00:00Z', link_url:'https://example.test' },
    { id:'o2', title:'Graduate Trainee Programme', organisation:'Access Bank', category:'job', deadline:'2026-12-01', is_active:false, updated_at:'2026-11-03T08:00:00Z', link_url:'' },
  ] } }));
}

const studentSeed = () => {
  const email='student@example.test';
  localStorage.setItem('edureach-local-user-email', email);
  localStorage.setItem('edureach-privacy-preferences-v1', JSON.stringify({ necessary:true, analytics:false, savedAt:new Date().toISOString(), version:1 }));
  localStorage.setItem('sb-edureach-unconfigured-auth-token', JSON.stringify({access_token:'t',refresh_token:'r',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'student-1',aud:'authenticated',email,app_metadata:{},user_metadata:{full_name:'Aponi James'}}}));
  localStorage.setItem('edureach-local:student-example-test:profile', JSON.stringify({email,full_name:'Aponi James',phone:'08030000000',school:'University of Lagos',course_programme:'Computer Science',department:'Computer Science',faculty:'Science',level:'300',session:'2025/2026',admission_year:2022,expected_graduation_year:2026,academic_interests:['Software engineering','Data science'],notification_preferences:{email_alerts:true,whatsapp_alerts:false,sms_alerts:false},profile_completed:true}));
  const subjects=['Physics','Biology','Chemistry','Mathematics'];
  const scores=[82,74,68,90,64,71,58,77];
  scores.forEach((score,i)=>{const id='a'+i; localStorage.setItem(`edureach-local:student-example-test:cbt-result-${id}`,JSON.stringify({attempt:{id,score,correct_answers:Math.round(score/10),total_questions:10,submitted_at:new Date(Date.now()-i*86400000).toISOString(),exam_id:'e'+i,mode:i%2?'mock':'practice',selected_subjects:[subjects[i%4]]},exam:{title:subjects[i%4]},questions:[]}));});
  localStorage.setItem('edureach-local:student-example-test:service-requests', JSON.stringify([{id:'local-r1',reference_code:'LOCAL-1',service_id:'nelfund-loan',status:'submitted',created_at:new Date(Date.now()-3*86400000).toISOString(),form_data:{serviceTitle:'NELFUND Loan Support'}}]));
  localStorage.setItem('edureach-local:student-example-test:notifications', JSON.stringify([{id:'nt1',title:'Your request is being reviewed',body:'NELFUND Loan Support · ER-8F2K19',created_at:new Date().toISOString(),read:false}]));
};

async function settle(page) {
  // The mocked API still resolves through the real auth/profile providers, so a
  // fixed 400ms sometimes caught the skeleton. Wait for the page heading, then
  // give charts/lists one paint to finish.
  await page.waitForFunction(
    () => [...document.querySelectorAll('h1,h2')].some((el) => el.getBoundingClientRect().height > 0),
    null,
    { timeout: 12000 },
  ).catch(() => {});
  await page.waitForTimeout(600);
}

async function metrics(page) {
  return await page.evaluate(() => {
    const vw = window.innerWidth;
    const overflow = [...document.querySelectorAll('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (s.position === 'fixed' || s.display === 'none' || s.visibility === 'hidden') return false;
      return r.width > 0 && r.right > vw + 1;
    }).slice(0, 8).map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 70), right: Math.round(el.getBoundingClientRect().right), w: Math.round(el.getBoundingClientRect().width) }));
    const tiny = [...document.querySelectorAll('button, a, input, select, textarea, [role="button"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || r.width === 0 || r.height === 0) return false;
      if (el.matches('a') && getComputedStyle(el).display === 'inline') return false;
      return r.width < 40 || r.height < 40;
    }).slice(0, 12).map((el) => ({ tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 34), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }));
    const clipped = [...document.querySelectorAll('h1,h2,h3,p,td,span,div')].filter((el) => el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible').slice(0,8).map((el)=>({tag:el.tagName,cls:String(el.className).slice(0,50),text:(el.textContent||'').trim().slice(0,50)}));
    return { vw, docWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, overflow, tiny, clipped };
  });
}

async function runStudent(widths) {
  const results = [];
  for (const width of widths) {
    const context = await browser.newContext({ viewport:{ width, height: width <= 430 ? 900 : 1000 }, deviceScaleFactor: 1, hasTouch: width <= 768 });
    const page = await context.newPage();
    const errors=[]; page.on('pageerror', e=>errors.push(e.message)); page.on('console', m=>{ if(m.type()==='error') errors.push(m.text().slice(0,160)); });
    await page.addInitScript(studentSeed);
    for (const path of ['/dashboard','/profile','/dashboard/cbt','/cbt','/login','/search?q=jamb']) {
      await page.goto(BASE + path, { waitUntil:'domcontentloaded' });
      await settle(page);
      const consent = page.getByRole('button', { name:'Reject optional' });
      if (await consent.isVisible().catch(()=>false)) await consent.click();
      const m = await metrics(page);
      results.push({ app:'student', path, width, ...m, errors:[...new Set(errors)] });
      if (['/dashboard','/profile','/login','/cbt'].includes(path) && [1440,390,320].includes(width)) {
        await page.screenshot({ path:`${OUT}/student-${path.replace(/[^a-z]+/gi,'-')}-${width}.png`, fullPage:true });
      }
    }
    await context.close();
  }
  return results;
}

async function runAdmin(widths) {
  const results = [];
  const routes = ['/admin','/admin/users','/admin/queue','/admin/news','/admin/analytics','/admin/cbt','/admin/services','/admin/schools','/admin/opportunities','/admin/content','/admin/content-manager','/admin/question-imports','/admin/banks','/admin/pdf-bank','/admin/site'];
  for (const width of widths) {
    const context = await browser.newContext({ viewport:{ width, height: width <= 430 ? 900 : 1000 }, deviceScaleFactor: 1, hasTouch: width <= 768 });
    const page = await context.newPage();
    await mockAdmin(page);
    const errors=[]; page.on('pageerror', e=>errors.push(e.message)); page.on('console', m=>{ if(m.type()==='error') errors.push(m.text().slice(0,160)); });
    for (const path of routes) {
      await page.goto(BASE + path, { waitUntil:'domcontentloaded' });
      await settle(page);
      const m = await metrics(page);
      results.push({ app:'admin', path, width, ...m, errors:[...new Set(errors)] });
      if (['/admin','/admin/users','/admin/queue','/admin/news'].includes(path) && [1440,390,320].includes(width)) {
        await page.screenshot({ path:`${OUT}/admin-${path.replace(/[^a-z]+/gi,'-')}-${width}.png`, fullPage:true });
      }
    }
    await context.close();
  }
  return results;
}

const student = await runStudent([1440,1280,768,430,390,360,320]);
const admin = await runAdmin([1440,1280,768,430,390,360,320]);
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ student, admin }, null, 2));
console.log('done', student.length, admin.length);
await browser.close();
