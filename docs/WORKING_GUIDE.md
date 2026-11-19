EduReach Hub: Developer Working Guide
From idea to live platform, stage by stage, written for developers who are learning the job.
How to Use This Guide
EduReach Hub is not a normal information website. It is an exam-practice product (a CBT platform). Students sit simulated JAMB, WAEC, NECO and Post-UTME exams. They need the simulator to feel like the real thing, to be fast on weak internet, and to never lose their answers.
Because of that, three things matter more than anything else:
1. Correct questions. One wrong answer key damages trust.
2. A reliable exam engine. Timer, autosave, resume, submit and grading must be exact.
3. Speed on bad networks and cheap phones.
Every stage below uses the same layout so you always know where to look:
* Goal: why this stage exists.
* Who is involved.
* Steps: what to actually do, in order.
* Recommended practices: the habits professionals follow.
* Common mistakes: what beginners get wrong.
* Outputs: what you must have produced.
* Done checklist: do not move to the next stage until every box is true.
Rule for beginners: if you do not understand a word, check the glossary below. If you still do not understand, ask. Guessing is how bugs are born.
Plain-English Glossary
* Frontend: the part users see and tap (pages, buttons, the exam screen). Runs in the browser.
* Backend: the part users do not see. It stores data, checks rules, grades exams. Runs on a server.
* API: a set of addresses (called endpoints) the frontend calls to ask the backend for things. Example: POST /attempts/123/answers saves an answer.
* Database: where permanent data lives (users, questions, attempts, results). We use PostgreSQL.
* Migration: a versioned script that changes the database structure. Never change the database by hand.
* Environment: a separate copy of the system. Local (your laptop), Development (shared testing), Staging (copy of production for final checks), Production (the real one students use).
* Repository (repo): the folder where code lives, tracked by Git.
* Branch: your own copy of the code to work on safely.
* Pull request (PR): a request to merge your branch into the main code, so others can review it.
* CI/CD: robots that automatically build, test and deploy your code every time it changes.
* Cache: a fast temporary store (like Redis) for data that is read often.
* Queue: a waiting line for background jobs (grading, imports, emails) so the website stays fast.
* CDN: a network of servers around the world that deliver images and files quickly from a place near the student.
* PWA (Progressive Web App): a website that can be installed on a phone and can work partly offline.
* Service worker: a script in the browser that caches files and helps the app work offline.
* IndexedDB: a database inside the browser. We use it to keep a student's answers safe on their own device.
* Idempotent: doing the same action twice has the same result as doing it once. Critical for saving answers and submitting exams.
* Server-authoritative: the server has the final say (for example, about time). The student's device is never trusted.
* Snapshot: a frozen copy. When an exam starts we freeze the exact questions so later edits cannot change that exam.
* Blueprint: the settings for an exam type (subjects, number of questions, duration, rules), stored as data, not hard-coded.
* Rate limiting: limiting how many requests one user or address can make, to stop abuse and scraping.
* Index (database): a lookup structure that makes queries fast.
* Load test: simulating many users at once to see what breaks.
* Rollback: going back to the previous working version after a bad release.
* Feature flag: a switch that turns a feature on or off without deploying new code.
* p95 / p99 latency: the response time that 95% (or 99%) of requests are faster than. Better than averages for spotting slowness.


Stage 1: Discovery and Validation
Goal
Decide whether to build this, who it is for, and what "success" means, before spending money on code.
Who is involved
Founder or product owner, a business analyst or researcher, a tech lead, and someone who can give legal advice.
Steps
Step 1.1: Write the problem statement. One short paragraph.
* Example: Nigerian secondary-school and UTME students cannot easily practise in an environment that feels like the real CBT exam. Many practise on low-quality apps that lose progress, load slowly on weak networks, or have wrong answers.
* Add: who has the problem, how often, how they cope today, and why that is not good enough.
Step 1.2: Talk to real people. Do not skip this.
* Interview at least 10 to 20 students (JAMB candidates, WAEC/NECO candidates, Post-UTME candidates), plus a few teachers, tutors and CBT-centre owners.
* Ask open questions: How do you practise now? What phone or laptop do you use? How much data do you buy? What do you hate about the apps you use? What would make you pay? When do you study (time of day)? Do you study with friends?
* Write down exact words. Look for patterns, not single opinions.
Step 1.3: Study competitors.
* List every popular CBT/past-question app and website used in Nigeria.
* For each one: create an account, take a full mock exam, and note speed, realism, mobile experience, data usage, price, adverts, answer explanations, and how it behaves when you turn off the internet.
* Write a simple table: what they do well, what they do badly. Your product wins in the bad column.
Step 1.4: Create user personas (3 is enough).
* Example persona: Chidera, 17, SS3, Android phone with a cracked screen, 1GB of data a week, studies at night, panics when apps hang.
* For each: device, data habits, exam, goals, frustrations.
* These personas decide technical choices (for example, a small download size).
Step 1.5: Learn the real exams properly.
* Study how the real exams work: number of subjects, number of questions per subject, duration, navigation rules, calculator rules, scoring, how the screen looks.
* Always check official sources (the exam bodies' websites, official brochures and syllabi). Formats change. Do not rely on memory or on blog posts.
* Save each source link and the date you checked it in a shared document.
* Different universities run different Post-UTME formats. Treat each institution as its own blueprint.
Step 1.6: Decide where questions come from, and whether you may use them.
* Options: questions written by your own teachers, licensed content, partner schools or publishers, public-domain material, past questions with permission.
* Past questions are owned by someone. Ask a lawyer what you may republish and what credit or permission is needed.
* Plan for quality: who checks every question? Budget for reviewers (teachers).
Step 1.7: Check data-protection and legal duties.
* Many users are under 18. Review the Nigeria Data Protection Act (NDPA 2023) and guidance from the Nigeria Data Protection Commission with a lawyer.
* Decide: what personal data we collect (keep it minimal), why, how long we keep it, how a user can delete their data, how parents or schools consent for minors.
* You will need a Privacy Policy and Terms of Use.
Step 1.8: Choose a business model.
* Free plus paid plans, subscription per exam season, pay per mock exam, school licences, or sponsorships.
* Think about payment methods Nigerians actually use: cards, bank transfer, USSD, mobile money, and providers like Paystack or Flutterwave. Many students have no card, so budget extra effort for alternatives.
* Business model affects the build: plans, locked content, coupons, school admin accounts.
Step 1.9: Define success metrics. Numbers you can measure, such as:
* Registered students and weekly active students
* Exams started and exams completed (completion rate)
* Return rate after 7 days
* Paid conversion rate
* Reports of wrong questions per 1,000 questions served (quality)
* Crash-free sessions and autosave success rate (reliability)
Step 1.10: Estimate feasibility and cost.
* Hosting, database, CDN, email and SMS, payment fees, content creation and review, design, developer time, monitoring tools.
* Be realistic about data costs for users: smaller pages equals more users.
Step 1.11: Start a risk register. A simple table: risk, how likely, how bad, what we will do.
* Examples: wrong answers, content licensing dispute, traffic spike in exam season, scraping of our questions, cheap-phone performance.
Step 1.12: Make the go or no-go decision with everyone who matters, and write it down.
Recommended practices
* Validate with real users first, build second.
* Keep a shared folder: interview notes, competitor table, official exam sources with dates, legal notes.
* Decide the one or two things you will be best at (for example: realism plus reliability on weak networks).
Common mistakes
* Assuming you know what students want without asking them.
* Using unofficial blog posts as the exam format.
* Ignoring content licensing until after launch.
* Forgetting that students are minors.
* Planning only for fast phones and good Wi-Fi.
Outputs
Problem statement, interview notes, competitor table, personas, exam-format notes with sources, content and licensing plan, data-protection notes, business model, success metrics, cost estimate, risk register, written go or no-go.
Done checklist
* ☐ Evidence that students want this, from real conversations
* ☐ Personas include device and data assumptions
* ☐ Official exam formats recorded with source links and dates
* ☐ Question sourcing and licensing position agreed
* ☐ Data-protection approach agreed with legal advice
* ☐ Success metrics are numbers
* ☐ Budget and go decision recorded


Stage 2: Requirements and Planning
Goal
Turn the idea into exact, testable instructions that designers and developers can build without guessing. Write the exam engine rules first, because everything depends on them.
Who is involved
Product manager or owner, tech lead, designers, senior developers, a teacher or subject expert (for exam rules), and the project manager.
Steps
Step 2.1: Write user stories with acceptance criteria.
* Format: As a [type of user], I want [something], so that [benefit].
* Every story gets acceptance criteria: a short list of things that must be true for the story to count as done.
* Example:
   * Story: As a JAMB candidate, I want my answers saved automatically, so that I do not lose work if my network drops.
   * Criteria: answers are saved on the device immediately; answers sync to the server when the connection returns; after a refresh the student returns to the same question with the same answers; a clear indicator shows saved or not saved.
* Write stories for: sign up, log in, choose exam, choose subjects, practise, take a full simulation, resume an interrupted exam, submit, see results, review answers, see progress, report a bad question, pay, and every admin task.
Step 2.2: Define the exam modes precisely.
Mode
	Timer
	Feedback
	Purpose
	Practice (learn)
	None
	Instant answer and explanation after each question
	Learning
	Timed practice
	Yes
	Results at the end
	Speed training
	Full simulation
	Strict, matches real exam
	None until submit
	Realistic rehearsal
	Review
	None
	Full walkthrough of a finished attempt
	Learning from mistakes
	Step 2.3: Write the exam rules (answer every question below in writing).
* How is the timer shown, and what happens when it reaches zero? (Auto-submit.)
* Is the timer for the whole exam or per subject?
* Can students go back to previous questions? Skip? Flag for review?
* Does the question number grid show answered, unanswered and flagged?
* Can a student change an answer before submitting? (Usually yes.)
* What happens if the student refreshes the page? (Resume, with the correct remaining time.)
* What happens if the student closes the browser and returns later? (Resume if time remains; auto-submitted if time ran out.)
* What happens if the internet drops? (Keep working; save locally; sync later.)
* What happens if the device battery dies and the student logs in on another device? (Resume on the new device.)
* Can the same account be in two exams at once? (Decide: normally no.)
* What does the submit confirmation say? Can the student undo it? (No.)
* What does the student see after submit: score only, or review too?
* Are questions and options shuffled? How is the order kept stable on resume?
* How are unanswered questions scored? Is there negative marking? (Follow the real exam rules.)
* How are scores shown (raw score, percentage, scaled to the real exam scale)?
* Is a calculator available? For which subjects?
* How do passage-based questions (comprehension) work?
If a rule is not written down, a developer will invent one. Different developers will invent different ones.
Step 2.4: Make exam blueprints data, not code.
* A blueprint describes an exam type in settings:
   * Name (for example, JAMB UTME)
   * Subjects allowed and how many subjects per student
   * Questions per subject
   * Total duration (or per subject)
   * Scoring rules and negative marking if any
   * Shuffling and navigation rules
   * Whether calculators or special tools are allowed
* Store blueprints in the database (or a config file loaded into it). Adding WAEC or a university Post-UTME later then means adding a blueprint, not rewriting the engine.
* Version blueprints too, so old attempts remain explainable.
Step 2.5: Write non-functional requirements with numbers.
* Speed: first question visible within a target time on a throttled 3G connection (for example, 5 seconds).
* Size: the exam page's JavaScript under a set budget (for example, 200 KB compressed). The build fails if it grows past this.
* Reliability: zero lost answers under network drops, refreshes and crashes.
* Capacity: concurrent exam-takers now and at peak season (for example, 5,000 now and 50,000 at peak). Define what "concurrent" means: active exams with autosave running.
* Availability: uptime target, and special care in exam season.
* Security: no answer keys leaked, no unauthorised access, rate limits.
* Accessibility: readable contrast and font sizes, keyboard use on desktop.
* Compatibility: browsers and devices we support (include low-end Android).
Step 2.6: Prioritise. Use MoSCoW:
* Must: accounts, JAMB simulation, practice mode, server timer, autosave and resume, grading, results, admin import and review.
* Should: WAEC and NECO, progress charts, question reporting, payments.
* Could: leaderboards, study streaks, video explanations.
* Won't (yet): native apps, adaptive learning, live classes.
Step 2.7: Choose how the team works.
* Recommended: Agile with 2-week sprints. Each sprint ends with something that works and can be shown.
* Use a board (Jira, Linear, Trello): Backlog, To do, In progress, In review, Testing, Done.
* Write a Definition of Ready (a story can start only when it has acceptance criteria, designs, and no open questions) and a Definition of Done (see Stage 5).
Step 2.8: Estimate and roadmap.
* Break stories into small tasks (one to three days each). Estimate with the team, not for the team.
* Add buffer time. Software always takes longer than the first guess.
* Plan around real deadlines: exam seasons. Launching a week before a major exam is dangerous.
Step 2.9: Assign ownership. Who owns the exam engine? The question bank? The admin tools? Infrastructure? Every area needs one named owner.
Step 2.10: Record decisions. Keep a decision log (one short note per big choice: what we chose, why, what else we considered). New developers will thank you.
Recommended practices
* Write acceptance criteria in plain sentences a non-developer can check.
* Put real numbers on every performance and capacity goal.
* Ask a teacher to read the exam rules and confirm they match reality.
* Keep the MVP small: a reliable JAMB simulator beats five half-working exams.
Common mistakes
* Vague requirements like "the exam should be fast".
* Hard-coding JAMB rules into the code.
* Forgetting what happens on refresh, offline, or expired time.
* Planning a launch for the week of a big exam.
Outputs
Product Requirements Document, user stories with acceptance criteria, exam-mode rules, exam blueprints (as data), non-functional requirements with numbers, prioritised backlog, roadmap, risk register, decision log.
Done checklist
* ☐ Every requirement is clear, testable, and has acceptance criteria
* ☐ Exam rules answered in writing, including failure cases
* ☐ Blueprints for MVP exams defined as data
* ☐ Performance, capacity and reliability targets are numbers
* ☐ MVP scope agreed and signed off
* ☐ Developers confirm the plan is feasible
* ☐ Definition of Ready and Definition of Done written


Stage 3: Design
Design has four parts: UX (how it works), UI (how it looks), exam engine design (how the simulator behaves under pressure), and system design (data, stack, security). This section covers UX, UI and the exam engine. The data model, tech stack and security design follow in the next section.
Goal
Decide exactly how every screen works and how the exam engine will behave, before writing production code. Mistakes found in design cost minutes. Mistakes found after launch cost trust.
Who is involved
UX designer, UI designer, software architect, senior developers, a teacher, and real students for testing.


3A. UX Design (how it works)
Step 3A.1: Map the user journeys. Draw each journey as boxes and arrows.
* New student: land on site, sign up, pick exam (JAMB), pick subjects, take first practice, see result, see suggestion to continue.
* Returning student: log in, see dashboard, tap Continue, resume.
* Full simulation: pick exam, confirm subjects, read instructions, start, answer, flag, review, submit, results.
* Interrupted exam: network drops, student keeps answering, connection returns, answers sync silently.
* Admin: upload questions, fix errors, review, approve, publish.
Step 3A.2: Build the sitemap. List every page: Home, Sign up, Log in, Dashboard, Exam picker, Subject picker, Instructions, Exam screen, Result, Review, Progress, Account, Pricing, Help, Privacy, Terms, Admin pages.
Step 3A.3: Draw wireframes (simple grey-box layouts, no colours). Wireframe every screen and every state:
* Empty state (no attempts yet)
* Loading state
* Error state (what the student sees when something fails)
* Offline state
* Low-time warning state
* Success state
Step 3A.4: Make the exam screen match the real CBT feel.
* Layout: question area (centre), answer options (below the question), question number grid (side panel on desktop, slide-up drawer on mobile), subject tabs (top), countdown timer (always visible), Previous and Next buttons, Flag button, Submit button.
* The grid shows status with shape or icon plus colour (not colour alone): answered, unanswered, flagged, current.
* Submit asks for confirmation and shows a summary: number answered, number unanswered, number flagged.
* Copy the behaviour of real CBT systems students will meet. Do not copy logos or branding of exam bodies.
Step 3A.5: Design for anxiety. Exam students are stressed.
* Show a small, calm message such as All answers saved with a tick, and change to Saving... or Not saved yet, will retry when needed.
* Never show a scary red error for a temporary network problem. Say what is happening and that the student's work is safe.
* Give clear warnings at 10 minutes and 1 minute left.
* Keep screens free of adverts and clutter during an exam.
Step 3A.6: Build a clickable prototype and test it.
* Use Figma or similar.
* Give 5 to 8 real students tasks without helping them: Start a JAMB mock with English and three other subjects. Flag a question. Submit.
* Watch where they hesitate. Fix those places.
* Test on a real low-end Android phone.


3B. UI Design (how it looks)
Step 3B.1: Create a small design system.
* Colours: one main colour, one accent, success, warning, error, and neutrals. Check contrast ratios (aim for WCAG AA).
* Typography: one clean font family, a clear size scale (for example 14, 16, 18, 24, 32 px). Use system fonts or a small web font to save data.
* Spacing: use a fixed scale (4, 8, 12, 16, 24, 32).
* Components: buttons, inputs, radio options, cards, tabs, modals, toasts, progress bars, timers, question grid cells, tables.
* Document each component with its states: default, hover, focus, disabled, loading, error.
Step 3B.2: Design mobile first. Start from a 360 px wide screen, then enlarge for tablet and desktop.
* Tap targets at least 44 by 44 px.
* Answer options are big, full-width, easy to tap with a thumb.
* Nothing relies on hover.
* Test long questions, passages, tables, equations and diagrams on a small screen.
Step 3B.3: Plan for rich content.
* Maths and science notation: use a renderer such as KaTeX.
* Images and diagrams: tap to zoom, always with alt text.
* Passage-based questions: on mobile, show the passage in a collapsible panel above the question.
* Tables inside questions scroll sideways inside their own box, never breaking the page layout.
Step 3B.4: Plan accessibility.
* Text can be enlarged without breaking layout.
* Every input has a label.
* Keyboard users can reach everything on desktop (Tab order makes sense, focus is visible).
* Screen readers announce the timer warnings and the saved status politely, not constantly.
Step 3B.5: Plan for performance in the design itself.
* Few images. Use modern formats (WebP or AVIF) and set exact sizes.
* No heavy animation or auto-playing video.
* Skeleton screens (grey placeholders) instead of spinners where possible.


3C. Exam Engine Design (the heart of the system)
This is the most important design work in the whole project. Read each idea twice. Every idea exists because it fixes a real way exams go wrong.
Idea 1: The server controls time.
* Problem: a student can change their phone clock, or a browser can slow down timers in a background tab.
* Solution: when an exam starts, the server records started_at and works out ends_at (start plus duration).
* The student's screen shows a countdown, but it is only a display. Every time the app talks to the server, the server sends back its current time. The app corrects its clock using that.
* On resume (refresh or reopen), remaining time = ends_at minus server time now.
* When a submit arrives, the server decides if it is on time. Allow a tiny grace period (for example 5 to 10 seconds) for network delay. Answers saved before ends_at always count.
* If a student never submits, the server auto-submits at ends_at. Do this with a scheduled job or by checking the attempt's status whenever it is next opened.
Idea 2: An attempt is a frozen snapshot.
* When the student presses Start, create an attempt record. Save inside it: which blueprint version, which subjects, which exact question versions, and in which order (questions and options).
* If an admin edits or retires a question later, this attempt does not change. Results stay explainable.
Idea 3: Autosave safely, even offline.
* Every time a student picks an answer:
   1. Save it in the browser (IndexedDB) immediately.
   2. Mark it as pending sync.
   3. Send pending answers to the server in small batches (for example every 3 to 5 seconds, or after each answer using a short delay called debouncing).
   4. When the server confirms, mark it synced.
* If the request fails, keep it pending and retry using exponential backoff (wait 2 seconds, then 4, then 8, up to a limit).
* Each answer carries: attempt id, question id, chosen option, and a client timestamp or counter. If two versions arrive, the latest wins.
* The server must treat repeated sends as harmless (idempotent).
* Show the sync status in the UI.
* On final submit, the app first flushes all pending answers, then sends the submit request. The submit request can also carry the full answer set as a safety net.
Idea 4: Resume everywhere.
* When the student opens the app, it asks the server: Do I have an active attempt?
* If yes and time remains, load the snapshot, merge server answers with any pending local answers, restore the current question, and continue.
* If time has expired, the server has already auto-submitted: show the results.
* Works the same on another device, because the server has the saved answers.
Idea 5: Download the exam once, then work locally.
* When the exam starts, the server sends the whole question set for that attempt in one request (text is small).
* Images load in the background with a priority for the nearest questions.
* Moving between questions is instant and needs no network call.
* This is why weak internet does not ruin the exam.
Idea 6: Protect answer keys.
* In simulation and timed modes, never send correct answers to the browser while the exam is running. Anyone can open developer tools and read them.
* Grade on the server after submit.
* In practice mode, you may send the correct answer and explanation for that question only after the student answers it, or on request.
Idea 7: Grade in a separate, repeatable step.
* Flow: submit, mark attempt as submitted, put a grading job on a queue, a worker grades it, result is stored (score plus a row per question).
* Make grading re-runnable. If you later discover a wrong answer key, you can fix the key and regrade the affected attempts.
* Store the result so it never has to be recomputed to display.
Idea 8: Shuffling must be stable.
* Use a random seed saved with the attempt. The same seed always gives the same order, so refreshing never reshuffles.
Idea 9: Handle two devices or two tabs.
* Decide a rule (recommended: one active session per attempt).
* If the student opens the exam on a second device, either block it politely or let the newest take over and tell the old one to stop (using a session token stored on the attempt).
* Prevent two tabs from both writing answers: use a lock or the same session token check.
Idea 10: Plan every failure. Write a table and test every row.
What goes wrong
	What should happen
	Student refreshes
	Resume at same question, correct time
	Internet drops
	Keep answering, answers saved on device, sync later
	Internet returns
	Pending answers sync automatically
	Phone dies
	Log in elsewhere, resume with saved answers
	Clock is changed
	Server time wins
	Tab sleeps
	On wake, resync with server, fix countdown
	Double-tap submit
	One result only
	Submit after time
	Accepted only within grace; otherwise auto-submit result stands
	Server restarts
	No data lost; attempt resumes
	Server overloaded
	Client queues and retries; student sees calm message
	Recommended practices
* Draw the exam flow as a diagram and have a second developer try to break it on paper.
* Test the prototype on slow connections and low-end phones before building.
* Keep UI text short, simple and kind.
* Decide now what the server does and what the browser does. Server: time, grading, rules, security. Browser: display, local save, comfort.
Common mistakes
* Trusting the browser's clock.
* Calling the server every time the student moves to the next question.
* Letting question edits change old attempts.
* Sending answer keys to the browser during a real simulation.
* Designing only the happy path.
* Using colour alone to show question status.
Outputs so far
Journeys, sitemap, wireframes with all states, clickable prototype with test notes, design system, exam engine rules and failure table.
Done checklist (for 3A to 3C)
* ☐ Real students completed key tasks on the prototype
* ☐ Every screen has loading, error, offline and empty states designed
* ☐ Designs work at 360 px width and meet contrast rules
* ☐ Developers reviewed designs and confirmed they are buildable
* ☐ Exam engine failure table is complete and agreed
* ☐ Server-authoritative timing, snapshot, autosave and resume are clearly specified


3D. Data Model (what we store)
Think of the database as a set of tables. Each table is like a spreadsheet with rows. These are the main ones. Names are suggestions.
Users and access
* users: id, name, email or phone, password hash, role (student, reviewer, admin), status, created_at, consent info, date of birth or age band (for minors rules).
* sessions or refresh_tokens: who is logged in, from which device, when it expires.
* plans and subscriptions: what a user has paid for and until when.
* payments: provider reference, amount, status, raw webhook record.
Question bank
* exam_bodies: JAMB, WAEC, NECO, and institutions for Post-UTME.
* subjects: English, Mathematics, Physics, etc., with codes.
* topics: belong to a subject (for example Algebra, Mechanics). Add a syllabus reference if possible.
* passages: shared text for comprehension-style questions.
* questions: id, subject, topic, passage (optional), exam body, year, question text, explanation, difficulty, source, status, version, created_by, reviewed_by.
* question_options: question id, label (A, B, C, D), text, is_correct.
* question_media: images or diagrams linked to a question or option.
* question_versions: a copy of old versions whenever a published question is edited.
* question_reports: student reports (wrong answer, typo, bad image) with status.
Exams
* exam_blueprints: name, rules, duration, scoring, version.
* blueprint_subjects: which subjects and how many questions each.
* attempts: id, user, blueprint and version, mode, started_at, ends_at, status (in progress, submitted, auto-submitted, graded), random seed, session token.
* attempt_questions: the snapshot: attempt id, question id, question version, position, option order.
* attempt_answers: attempt id, question id, chosen option, flagged, answered_at, client counter. One row per question per attempt, unique on (attempt, question).
* results: attempt id, total score, per-subject scores, graded_at, grader version.
* result_items: per-question correct or not, time spent.
Admin and safety
* import_batches: file name, uploader, counts, status, error report location.
* import_rows (optional): each row's outcome.
* audit_logs: who did what, to which record, when, from where.
Rules for good tables
* Every table has an id, created_at and updated_at.
* Use foreign keys so you cannot point to something that does not exist.
* Add unique constraints where duplicates must never exist (one answer row per question per attempt).
* Add indexes on columns you search or join on often (user id, attempt id, subject id, status, year).
* Never delete important records for real. Use a status like retired or archived (soft delete).
* Store money as whole numbers in the smallest unit (kobo), never as decimals.
* Store all times in UTC.
Question statuses (the lifecycle) Imported (draft) then Needs review then Approved then Published then (Flagged or Retired). Only Published questions may appear in student exams.


3E. Technical Stack and Architecture
Recommended shape: a modular monolith.
* One backend codebase, split into clear modules: auth, users, question-bank, exam-engine, grading, results, payments, admin, notifications.
* Modules talk through well-defined functions, not by reaching into each other's tables.
* Why: simpler to build, test, deploy and debug for a small team. You can pull a module out into its own service later when real traffic demands it.
* Avoid microservices at the start. They add network problems, deployment complexity and cost.
Suggested components
* Frontend: a React-based framework (for example Next.js) with TypeScript, built as a PWA. Keep the exam page lean.
* Backend: a mainstream framework you and the team know well (Node with NestJS or Express, Django, Laravel, or similar). Pick for team skill and hiring, not hype.
* Database: PostgreSQL (reliable, strong with relational data, good with indexes and transactions).
* Cache and timers: Redis (rate limits, short-lived caches, locks, queues).
* Queue and workers: a job system (BullMQ, Celery, Sidekiq, or similar) for grading, imports, emails, analytics.
* File storage: object storage (S3-compatible) for images and import files.
* CDN: in front of static files and images.
* Hosting: a cloud provider with a region close to Nigeria's users if possible, or a CDN with Africa presence. Check latency from Lagos, Abuja and other cities.
* Monitoring: error tracking (Sentry), logs, metrics and uptime checks.
API design rules
* One API serves web, future mobile and future Windows apps. Do not put exam rules only in the frontend.
* Version it: /api/v1/....
* Use clear, predictable names. Example endpoints:
   * POST /auth/register, POST /auth/login, POST /auth/refresh
   * GET /exams (blueprints available to the student)
   * POST /attempts (start an attempt)
   * GET /attempts/{id} (resume: snapshot, answers, server time, ends_at)
   * PUT /attempts/{id}/answers (batch save answers)
   * POST /attempts/{id}/submit
   * GET /attempts/{id}/result
   * GET /me/progress
   * POST /questions/{id}/report
   * Admin: POST /admin/imports, GET /admin/imports/{id}, GET /admin/review-queue, POST /admin/questions/{id}/approve, and so on.
* Return consistent error shapes with a code and a friendly message.
* Validate every input on the server. Never assume the frontend did it.
* Use pagination for lists. Never return thousands of rows at once.
* Document the API (OpenAPI/Swagger) so frontend, mobile and testers share one truth.
Performance design choices
* Cache read-heavy, rarely changing data (blueprints, subject lists, published question sets).
* Serve the question set for an attempt as one compact response (compressed with gzip or brotli).
* Keep autosave endpoints tiny and fast: validate, write, return.
* Use database connection pooling.
* Write the autosave in a way that does not need heavy reads. One upsert per answer batch.
* Move slow work (grading, imports, emails) to the queue.
Scalability design choices
* Keep the backend stateless (no student data held in server memory), so you can run many copies behind a load balancer.
* Store sessions and locks in Redis or the database, not in one server's memory.
* Plan database read replicas for results and analytics later.
* Separate heavy admin imports from student traffic (own queue, own workers).
* Prepare for the spike: many students pressing Start at the same minute. Cache the data they all need and make attempt creation cheap.
Future mobile and Windows
* Keep the exam logic in a shared module or clearly documented API behaviour.
* Design question content as versioned packs (a bundle of questions with a version number). This allows offline downloads later.
* Design sync so a native app can behave like the PWA: save locally, sync later, server decides time.
* Options later: React Native or Flutter for phones; Tauri or Electron for Windows.


3F. Security Design
Accounts
* Hash passwords with a modern algorithm (Argon2 or bcrypt). Never store plain passwords.
* Require reasonable password strength, but do not force silly rules. Offer email verification.
* Short-lived access tokens plus refresh tokens. Store tokens safely (HTTP-only secure cookies are recommended for web).
* Rate limit login and password reset to stop guessing attacks. Add account lockout or delays.
* Allow users to see and revoke active sessions.
Permissions
* Roles: student, reviewer, admin, (later) teacher and school admin.
* Check permissions on the server for every request. Hiding a button is not security.
* A student may only read and write their own attempts and results. Test this directly.
Protect the question bank (your main asset)
* Do not expose unpublished questions or answer keys on any public endpoint.
* Rate limit question endpoints per user and per address. Watch for scraping patterns (one account pulling thousands of questions).
* Practice mode: serve a limited batch at a time.
* Optionally add subtle watermarking or tracking for leaked content.
* Free plans get limited access; paid plans get more.
Data safety
* Use HTTPS everywhere (and HSTS).
* Protect against the common attacks: SQL injection (use parameterised queries or an ORM), cross-site scripting (escape output; sanitise rich question HTML), cross-site request forgery (CSRF tokens or same-site cookies), insecure file uploads (check type, size, and scan; store outside the web root).
* Encrypt sensitive data at rest where supported.
* Collect only the personal data you need, especially for minors.
* Keep audit logs of admin actions.
* Backups are encrypted and access-limited.
Payments
* Never trust the browser to say a payment succeeded. Confirm with the provider's server using a verified webhook (check the signature).
* Make webhook handling idempotent (the provider may send the same event twice).
* Store payment references, not card numbers.
Secrets
* API keys, database passwords and signing keys live in a secrets manager or environment variables. Never in the repository. Rotate them if exposed.
Recommended practices
* Write the data model on paper first. Ask: What happens when a question is edited? When a user is deleted? When an attempt is regraded?
* Keep API and database names consistent and boring.
* Choose technology your team can maintain at 2 a.m.
* Review the security design with someone who has not worked on it.
Common mistakes
* Storing answers only in the browser, or only in the server's memory.
* Using one table that mixes questions and attempts.
* No indexes, then wondering why exams are slow with real data.
* Building microservices for a product with zero users.
* Hard-coding secrets in code.
Outputs
ER diagram and schema, API specification, architecture diagram, stack decision records, security design document.
Done checklist (Stage 3 complete)
* ☐ Data model supports versioning, snapshots, and regrading
* ☐ API specification written and reviewed by frontend and backend
* ☐ Architecture meets the capacity and speed targets on paper
* ☐ Security design reviewed
* ☐ Stakeholders signed off on designs and architecture


Stage 4: Environment and Project Setup
Goal
Give every developer a safe, identical place to work, and make sure every change is automatically checked.
Who is involved
Tech lead, DevOps or senior developer, all developers.
Steps
Step 4.1: Create the repository.
* Use GitHub, GitLab or Bitbucket. Decide: one repo (monorepo) with frontend, backend, docs, or separate repos. For a small team, a monorepo is often simpler.
* Add a README that explains: what the project is, how to run it, how to run tests, how to contribute.
* Add .gitignore so secrets, build files and local settings are never committed.
* Add a licence or private notice as appropriate.
Step 4.2: Set branch rules.
* main is always deployable. Nobody pushes straight to it.
* Work happens on short-lived branches named like feature/autosave-queue or fix/timer-resume.
* Require pull request reviews and passing checks before merging (set this in repository settings).
* Recommended: small pull requests (under about 400 changed lines). Small ones get better reviews.
Step 4.3: Create the environments.
Environment
	Purpose
	Data
	Local
	Each developer's machine
	Fake seed data
	Development
	Shared integration
	Fake data, reset often
	Staging
	Exact copy of production setup
	Realistic volume, anonymised
	Production
	Real students
	Real data
	* Use containers (Docker) so everyone runs the same versions of the database, Redis and tools. Provide one command (for example docker compose up) to start everything.
* Keep configuration in environment variables, with an .env.example file listing every variable (without real secrets).
* Production and staging must never share a database.
Step 4.4: Set code standards.
* A linter (ESLint, Flake8, etc.) and a formatter (Prettier, Black) with agreed rules, run automatically.
* TypeScript in strict mode for frontend and backend if using JavaScript.
* Naming rules, folder structure, how to write comments, how to write commit messages (for example: fix: resume attempt with correct remaining time).
* A short CONTRIBUTING guide.
Step 4.5: Build the CI/CD pipeline. On every pull request the robot should:
1. Install dependencies.
2. Run the linter and formatter check.
3. Run type checks.
4. Run unit and integration tests.
5. Run a dependency vulnerability scan.
6. Build the project.
7. Check the bundle size against the budget for the exam page, and fail if exceeded.
8. Deploy a preview or deploy to development when merged.
On merge to main: build, test, deploy to staging automatically. Production deployment is a deliberate, approved step.
Step 4.6: Set up database migrations. Choose a migration tool (built into your framework). Rules: every database change is a migration file in the repository; never edit old migrations; test that a migration works on a copy of staging data; plan how to undo it.
Step 4.7: Set up test tooling early. Unit test runner, integration tests against a real test database, end-to-end test tool (Playwright or Cypress), and a place to store test reports.
Step 4.8: Manage secrets. Use a secrets manager (cloud provider or a tool like Vault/Doppler). Give each environment its own secrets. Never paste secrets in chat, tickets or code. Turn on secret scanning in the repository.
Step 4.9: Set up observability early. Error tracking, structured logs (with request ids, never with passwords or full tokens), basic metrics. It is much harder to add after launch.
Step 4.10: Set up project tracking and communication. Board, a chat channel for the team, a channel for production alerts, a shared documentation space, and a place for the decision log.
Step 4.11: Seed realistic data. Create scripts that fill a staging database with thousands of questions (with images, formulas, passages) and many fake students and attempts. An empty database hides performance problems.
Step 4.12: Write the onboarding test. A new developer should be able to clone the repo, follow the README, run the app and the tests, and open a pull request in under one day (ideally under one hour to run it).
Recommended practices
* Automate everything you do twice.
* Make the safe way the easy way (one command to run, test, lint).
* Keep staging as close to production as possible (same versions, same settings, same type of services).
Common mistakes
* Developers on different versions of tools.
* Real secrets in the repository history.
* No CI, so broken code reaches the main branch.
* Staging that does not match production, so bugs appear only after launch.
Outputs
Repository with README and standards, branch protections, Docker setup, environments, CI/CD pipeline, migration tooling, test tooling, secrets management, monitoring base, seed data scripts, contributor guide.
Done checklist
* ☐ A new developer runs the whole project locally following only the README
* ☐ CI runs on every pull request and blocks merging when it fails
* ☐ Bundle-size check is enforced
* ☐ No secrets in code; secret scanning is on
* ☐ Staging mirrors production's shape
* ☐ Seed script creates a realistic question bank and test students
* ☐ Error tracking and logging work in every environment


Stage 5: Development (Building the Product)
Goal
Build the product in small, tested pieces, in an order that lets you test the riskiest parts first.
Who is involved
Frontend, backend and full-stack developers, a tech lead who reviews, QA, and the product owner who confirms each feature.
The build order (and why)
Order
	Piece
	Why this order
	1
	Foundation: accounts, roles, database
	Everything needs users and tables
	2
	Question bank core
	The exam engine needs questions
	3
	Admin import and review
	You need quality questions to test properly
	4
	Practice mode
	Simplest way to use questions; proves rendering
	5
	Exam engine
	The hardest and most important part
	6
	Simulator UI
	Needs the engine underneath
	7
	Results and progress
	Needs finished attempts
	8
	Payments and plans
	Needs users and locked content
	9
	PWA and offline hardening
	Builds on a working app
	10
	Performance and scale hardening
	Needs real flows to measure
	The daily workflow for every task
1. Pick a task from the board. Read the story and acceptance criteria. If anything is unclear, ask before coding.
2. Pull the latest main and create a branch: git checkout -b feature/short-name.
3. Write a failing test first if you can (see Test-Driven Development below), then write the code until it passes.
4. Run the app locally and test it by hand, on a phone-sized screen and with network throttling.
5. Run the linter, formatter and all tests locally.
6. Commit small and often with clear messages.
7. Push and open a pull request. Fill in the template: what changed, why, how to test, screenshots, risks.
8. Wait for CI to pass. Fix failures yourself.
9. A teammate reviews. Answer comments politely. Fix or explain.
10. After approval, merge. Watch the deployment to development. Confirm it works there.
11. Move the ticket to Testing. Tell QA what to check.
How to review code (for every reviewer). Check: Does it meet the acceptance criteria? Is the logic correct, including edge cases? Is it easy to read? Are there tests? Any security problem (user input, permissions, secrets)? Any slow query or large payload? Does it handle errors and offline? Be kind and specific. Praise good work.


5.1 Foundation: Accounts, Roles, Database
Build
* Project skeleton, config loading, logging, error handling, health-check endpoint (GET /health).
* Database schema for users, sessions, roles using migrations.
* Registration with email or phone, email verification, login, logout, refresh tokens, password reset.
* Role-based access (student, reviewer, admin) enforced by middleware.
* Rate limiting on auth endpoints.
* Profile page: name, target exam, exam year, school (optional), preferences.
Beginner tips
* Never write your own password hashing. Use a trusted library.
* Never reveal whether an email exists on login or reset screens (say If this email exists, we sent a link).
* Reset tokens are single-use and expire quickly (for example 30 minutes).
* Write tests for: wrong password, expired token, reused reset token, student calling an admin endpoint.
Done when: a student can register, verify, log in, reset a password, and is blocked from admin routes; all covered by tests.


5.2 Question Bank Core
Build
* Tables from the data model: exam bodies, subjects, topics, passages, questions, options, media, versions, reports.
* Question statuses and the allowed transitions (Draft to Needs review to Approved to Published to Flagged or Retired). Enforce transitions in code. A question cannot jump from Draft to Published.
* Versioning: editing a published question creates a new version row and increments the version number. Old versions are kept.
* Content rendering component: displays question text, options, maths (KaTeX), images and passages safely.
   * Sanitise any HTML so a bad import cannot run scripts in a student's browser.
   * Test with long text, tables, fractions, chemical formulas, superscripts, diagrams.
* Media handling: upload images to object storage, compress them, generate several sizes, serve via CDN, always store alt text.
* Search and filter functions for admin: by subject, topic, year, status, exam body, text search.
Beginner tips
* Treat question content as untrusted input even from admins.
* Add database indexes for common filters (subject, status, year, exam body) once you see the queries.
* Keep the question text, options and answer in one transaction when saving, so you never save half a question.
Done when: you can create, edit, version, and status-change a question; the renderer shows rich content correctly on a 360 px screen; only Published questions can be fetched by the student-side code.


5.3 Admin Import, Review and Publish Pipeline
This is how thousands of questions get into the system safely.
Step A: The import template.
* Provide a downloadable CSV or Excel template with fixed columns: exam_body, year, subject_code, topic, question_text, option_a, option_b, option_c, option_d, (option_e if needed), correct_option, explanation, difficulty, passage_ref, image_refs, source.
* Provide a guide page with rules and examples. Fewer mistakes at the start saves hours later.
* Support images by referencing file names in a zip or pre-uploaded folder.
* Decide how to write maths in the file (for example LaTeX between markers), and document it.
Step B: Upload and parse.
* Admin uploads a file. The system saves it and creates an import batch record (status: Uploaded).
* Parsing runs in the background queue, not during the web request. Large files must not freeze the admin screen.
* Show progress (for example, Processed 1,200 of 5,000 rows).
Step C: Validate every row. Collect all problems, do not stop at the first one.
* Missing required fields
* Fewer than the required options, or blank options
* Duplicate options inside one question
* Correct answer not matching an existing option
* Unknown subject code or exam body
* Impossible year
* Broken or missing image references
* Invalid maths markup (try to render it)
* Suspicious HTML or scripts
* Very long text beyond limits
* Passage references that do not exist
Step D: Duplicate detection.
* Exact duplicates: compare a normalised version of the question text (lowercase, trimmed, no extra spaces) using a stored hash.
* Near duplicates: use a similarity check (for example trigram similarity in PostgreSQL) and flag likely matches for a human to decide.
* Show the admin the matching existing question side by side.
Step E: Dry run and error report.
* Before anything is saved as a draft, show a preview: how many rows are valid, how many have errors, how many duplicates.
* Offer a downloadable error report (same file with an extra column explaining each problem) so the uploader can fix and re-upload.
* Admin chooses: import valid rows only, or cancel.
Step F: Save as drafts, tied to the batch.
* Each created question stores its import_batch_id.
* Status becomes Imported (draft). Nothing is visible to students.
* If the batch was wrong, an admin can roll back the entire batch (retire or delete its drafts, and never touch questions that were already published unless explicitly chosen).
Step G: The review queue.
* Reviewers see questions exactly as students will see them (rendered, on mobile and desktop preview).
* Filters: subject, topic, year, batch, status, difficulty, reviewer.
* Actions: edit, approve, reject with a reason, request a second opinion, assign to another reviewer.
* Show the original source reference so the reviewer can compare against the real paper.
* Reviewers must check: question makes sense, options are clear, the marked answer is truly correct, the explanation is correct, subject and topic are right, year is right, image is sharp and readable, no copyright or licensing problem.
Step H: Quality rules before publishing.
* Recommended: two-person rule for high-traffic subjects (one reviewer approves, a different admin publishes).
* Sampling check for trusted bulk imports: a reviewer checks a random 5 to 10 percent; if errors exceed a limit, the whole batch goes back to review.
* Approved questions move to Published only by a publish action, which is logged.
Step I: Student reports close the loop.
* Each question shows a small Report a problem button (wrong answer, typo, image issue, other).
* Reports go to a triage queue.
* A question with several reports is auto-flagged and can be temporarily hidden from new exams pending review.
* When a published question is fixed, a new version is created and affected attempts can be regraded if the answer key changed (see 5.5).
Step J: Audit everything. Record who imported, edited, approved, published, flagged, retired, and when. This protects you when a question is disputed.
Step K: Admin permissions.
* Importer: can upload and see own batches.
* Reviewer: can review and approve.
* Publisher: can publish.
* Super admin: manages roles, rollback, settings.
Beginner tips
* Never insert imported rows straight into the Published state.
* Never run a huge import inside a single web request.
* Write unit tests for each validation rule, using bad sample files.
* Keep the importer idempotent: uploading the same file twice should detect duplicates, not double the bank.
Done when: an admin can upload a 5,000-row file with deliberate mistakes, see an accurate preview and error report, import the valid rows as drafts, review and publish some, roll back a batch, and see all of it in the audit log.
Recommended practices for 5.1 to 5.3
* Build the admin tools early. A bad question bank ruins good code.
* Keep import code and student code separate so heavy imports never slow exams.
* Write down the file format rules in plain English for non-technical uploaders.
Common mistakes for 5.1 to 5.3
* Letting import errors stop at the first problem.
* No audit log.
* Editing a published question in place, which silently changes old results.
* Trusting uploaded HTML.
* Putting reviewers and publishers in one all-powerful role.


5.4 Practice Mode
Build
* Student picks exam body, subject, topic (optional), number of questions, difficulty (optional), and year (optional).
* Server selects questions from Published questions only. Avoid repeats the student already saw recently when possible.
* After each answer, show correct or wrong and the explanation. Fetch explanation and answer only after the student answers (or on request).
* Save each practice answer (this feeds the progress and weak-topic features).
* Free users get daily limits or limited content; paid users get more. Enforce limits on the server.
Beginner tips
* Keep question selection fast: index by subject, status and topic; avoid ORDER BY RANDOM() on a huge table. Use a smarter method (pick random ids from an indexed range or a pre-built pool).
* Send questions in small pages, for example 10 at a time, and prefetch the next page.
Done when: a student can run a 20-question practice on a throttled connection with instant feedback and no repeated page reloads; limits work; results are saved.


5.5 The Exam Engine (Backend)
Take your time here. This is the most valuable code in the project. Write tests as you go.
Step 1: Blueprint loading.
* Read the blueprint (subjects, counts, duration, scoring, rules).
* Cache blueprints in memory or Redis. They rarely change.
Step 2: Start an attempt (POST /attempts).
1. Check the student is allowed (plan, limits, no other active attempt unless rules allow).
2. Check subject choices match the blueprint rules (for example, English plus three others for UTME).
3. Pick questions from Published questions per subject, following the blueprint. Respect topic spread if the blueprint asks for it.
4. Generate a random seed. Shuffle questions and options using the seed.
5. In one database transaction: create the attempt row (started_at = server now, ends_at = started_at + duration, status in progress, session token), and create all attempt_questions rows (the snapshot), including question version numbers.
6. Return: attempt id, server_time, ends_at, the snapshot of questions (without correct answers in simulation mode), blueprint rules for the UI.
7. Schedule an auto-submit job for ends_at (plus a small grace).
If step 5 fails halfway, the transaction must roll back so you never have an attempt with missing questions.
Step 3: Save answers (PUT /attempts/{id}/answers).
* Body: a list of items, each with question id, chosen option (or null to clear), flagged true or false, and a client counter or timestamp.
* Server checks: the attempt belongs to this user; status is in progress; session token matches; server time is before ends_at plus grace; each question belongs to this attempt's snapshot.
* Save with an upsert (insert or update) keyed by (attempt, question). Only overwrite if the incoming client counter is higher than the stored one. This makes saves safe to repeat and safe to arrive out of order.
* Return: how many were saved, current server_time, ends_at. The client uses this to correct its timer.
* Keep this endpoint extremely fast. Avoid extra queries. Use a single batched statement.
Step 4: Resume (GET /attempts/{id}).
* Return the snapshot, saved answers, flags, server_time, ends_at, and status.
* If status is in progress but ends_at has passed, trigger or confirm auto-submit and return the result link.
Step 5: Submit (POST /attempts/{id}/submit).
* Idempotent: if already submitted, return the existing outcome instead of an error.
* Accept an optional final batch of answers (a safety net). Apply them with the same rules as saving.
* Check time: if now is within ends_at plus grace, accept as a normal submit; otherwise the auto-submit has already handled it, so return that result.
* In one transaction, set status to submitted and submitted_at. Then enqueue the grading job.
* Return quickly. The student sees Submitted, preparing your result. The result page polls (or waits for a push) until grading finishes.
Step 6: Auto-submit job.
* At ends_at plus grace, a worker finds attempts still in progress and submits them using the answers saved so far.
* Backup plan: a periodic job (every minute) sweeps for any in-progress attempts past their end time. Never rely on one timer alone.
* Also check lazily: whenever an attempt is read or written and time has passed, finalise it.
Step 7: Grading worker.
* Load the snapshot, load answer keys for the versions in the snapshot, compare, and compute: total score, per-subject score, per-question correctness, time spent.
* Apply the blueprint's scoring rules (including any scaling or negative marking).
* Store results (results and result_items) in one transaction. Mark attempt as graded.
* Make the job idempotent and re-runnable. Keep a grader_version so you know how a result was computed.
* Regrade tool: for a given question (after a fixed answer key), find attempts that included it, recompute their results, and record what changed. Notify only if policy requires.
Step 8: Concurrency and locking.
* Only one active session per attempt. Store a session_token. When a second device resumes, either reject or rotate the token so the old device gets a clear message.
* Use database constraints and transactions rather than hoping code runs in the right order.
Step 9: Observability inside the engine.
* Log: attempt started, resumed, answers saved (count only), submit received, auto-submit fired, grading finished, with attempt id and timing.
* Metrics: save latency, save failures, submits per minute, grading queue depth.
* Never log answers in full or personal data you do not need.
Pseudo-code for the save step (read slowly):
function saveAnswers(user, attemptId, items, sessionToken):
 attempt = loadAttempt(attemptId)
 require attempt.userId == user.id
 require attempt.status == 'in_progress'
 require attempt.sessionToken == sessionToken
 now = serverNow()
 require now <= attempt.endsAt + GRACE
 for each item in items:
   require item.questionId is in attempt snapshot
 upsert into attempt_answers (attempt, question, option, flagged, counter)
   where incoming.counter > stored.counter
 return { saved: items.length, serverTime: now, endsAt: attempt.endsAt }
Test list for the engine (write all of these): start with wrong subject mix; start while another attempt is active; save after expiry; save with a wrong session token; save for a question not in the snapshot; save the same batch twice; save out of order; submit twice; submit after expiry; auto-submit for an abandoned attempt; grading with a negative-marking rule; regrade after an answer key fix; two devices; server restart mid-exam.
Done when: every item in the test list passes, and the failure table from Stage 3 is covered by automated tests.


5.6 The Simulator UI (Frontend)
Step 1: Keep the exam route lean.
* Load only what the exam needs (code-splitting). The exam page's JavaScript must stay inside the budget.
* No heavy libraries for small tasks. Check bundle size on every pull request.
Step 2: Local state and storage.
* A small, predictable state machine for the attempt: loading, ready, in progress, submitting, submitted, error.
* Keep the attempt in memory for speed and in IndexedDB for safety.
* Store: attempt id, snapshot, answers, flags, current question, pending sync queue, last known server time offset, session token.
Step 3: The timer.
* Compute remaining time from ends_at and a server time offset (server time minus device time at the last sync).
* Update the display every second using a method that corrects drift (calculate from timestamps each tick, do not just subtract one each second).
* Resync whenever a save response arrives and when the tab becomes visible again.
* At zero: stop input, flush saves, call submit, show Time is up, submitting your answers.
* Warnings at 10 minutes and 1 minute (visual first; make sure they are not disruptive).
Step 4: The sync queue.
* Each answer change goes into the queue (and IndexedDB) instantly.
* A sync loop sends batches, handles success and failure, retries with backoff, and updates the status indicator.
* Detect online or offline using the browser's connectivity events and actual request results (the connectivity flag alone can lie).
* Before submit, flush the queue. If flush fails, still call submit with the full answer set so the server can accept it.
Step 5: Navigation and the question grid.
* Next, Previous, jump to any question via the grid, subject tabs, flag toggle.
* Grid cell states: current, answered, unanswered, flagged (shape or icon plus colour).
* Keyboard shortcuts on desktop (arrow keys, number or letter keys for options), without breaking mobile.
Step 6: Submit flow.
* Show the confirmation with counts of answered, unanswered and flagged. Allow going back.
* Disable the button after the first tap, show progress, and handle the idempotent response.
* After submit, clear sensitive local data when safe, but keep what is needed for the result view.
Step 7: Resume flow.
* On opening the app, check IndexedDB and the server for an active attempt. Show a clear Continue your exam screen with the remaining time.
* Merge local pending answers and server answers by counter (higher counter wins).
Step 8: Protect fairness (gently).
* Do not try to build an unbreakable lock-down browser. It is not realistic on the web and hurts honest students. Focus on server-side integrity (time, answer keys, session control).
* You may record non-intrusive signals such as tab-away counts for practice analytics, but be clear and fair in the Terms.
Step 9: Every state is built. Loading skeleton, offline banner, retry buttons, calm messages, empty states, low-time warnings, failure screens with a way to continue.
Done when: a student can complete a 2-hour, 4-subject mock on a throttled phone, with the connection dropped twice and the page refreshed once, and loses nothing.


5.7 Results, Review and Progress
Build
* Result page: total score, per-subject scores, time used, answered vs unanswered, a short friendly message.
* Review mode: step through each question showing the student's answer, the correct answer, the explanation, and time spent. Review is only available after submit.
* Progress dashboard: scores over time (simple line chart), accuracy by subject and by topic, weakest topics, recent attempts, a Practise weak topics button.
* Pre-compute and store summaries. Do not recompute from raw rows on every page load.
* Allow Report this question from the review screen.
Beginner tips
* Show charts only if they help. Keep the dashboard simple and quick.
* Use database aggregation and caching for analytics, and do heavy calculations in background jobs.


5.8 Payments and Plans (if in scope)
Build
* Plans table, checkout flow with your payment provider, and a webhook endpoint.
* Flow: student chooses plan, server creates a payment with the provider, student pays, provider calls your webhook, you verify the signature, confirm with the provider's verify API, mark payment successful, activate the subscription.
* Make webhook handling idempotent (store the provider's event id and ignore repeats).
* Handle: failed payments, abandoned payments, delayed confirmations, refunds, expiry, renewal reminders.
* Gate paid features by a server-side check of the subscription, never by a flag from the browser.
* Provide a clear receipt and a way to contact support.
Beginner tips
* Test all of it in the provider's sandbox.
* Money is stored as integers in kobo.
* Log every payment event, but never log card details (you should never receive them).


5.9 PWA and Offline Resilience
Build
* A web app manifest (name, icons, colours) so users can install it.
* A service worker that caches the app shell (core JS, CSS, fonts, icons) so the app opens even on bad networks.
* Caching rules: static assets cache-first with versioned file names; API calls network-first with sensible fallbacks; never cache answer keys or private data in shared caches.
* An update flow: when a new version is available, tell the user politely; never reload mid-exam.
* An offline-friendly exam start: if a student has already loaded an attempt, they can continue without network.
* Later: downloadable question packs for offline practice, with version checks and safe expiry.
Beginner tips
* Service worker bugs are tricky. Test with the browser's application tools, including clearing storage and simulating offline.
* Always version your caches and clean old ones.


5.10 Performance and Scale Hardening
Frontend performance
* Budget: initial JavaScript, CSS, and images for the exam route. Enforce in CI.
* Code-split by route. Lazy load the charts, admin screens and heavy libraries.
* Compress text with brotli or gzip; use modern image formats; set image dimensions; lazy load below-the-fold images; preload the next question's images.
* Use system fonts or a small number of font files with font-display: swap.
* Avoid layout shifts. Use skeletons.
* Measure on a real mid-range and low-end phone with throttling (slow 3G and fast 3G profiles).
Backend and database performance
* Find slow queries with the database's query analyser. Add indexes where plans show full table scans.
* Avoid N+1 queries (looping and querying inside the loop).
* Use connection pooling and sensible timeouts.
* Cache hot, read-heavy data in Redis, with clear expiry and invalidation.
* Batch writes (autosave) and keep payloads small.
* Move slow work to queues.
* Paginate everything.
Scale hardening
* Run several backend instances behind a load balancer; confirm nothing important lives only in one instance's memory.
* Make sure the auto-submit and grading workers can scale out.
* Separate queues for grading, imports, emails, and analytics so one cannot starve another.
* Add back-pressure: if the system is overloaded, return a calm, retry-able response instead of failing wildly. The client's retry-with-backoff then smooths the load.
* Add a kill switch (feature flag) for heavy features during peak times.


Definition of Done (for every feature)
A feature is not done until all of these are true:
* ☐ Matches the acceptance criteria
* ☐ Code reviewed and approved by at least one other developer
* ☐ Automated tests written and passing (unit, integration, and exam-engine failure tests where relevant)
* ☐ No linter errors, no new security warnings, no bundle-size budget breach
* ☐ All states built (loading, empty, error, offline)
* ☐ Tested by hand on a phone-sized screen and a throttled network
* ☐ Accessible (labels, contrast, keyboard)
* ☐ Works on the development environment, not only your laptop
* ☐ Logging and metrics added where useful (without sensitive data)
* ☐ Documentation updated (README, API docs, decision log)
* ☐ Product owner confirmed it behaves as intended
Recommended practices for Stage 5
* Small pull requests, merged often.
* Write tests for exam rules before or with the code.
* Prefer boring, proven solutions.
* Never fix a bug without adding a test that would have caught it.
* Pair on the hardest parts (timer, sync, grading).
Common mistakes for Stage 5
* Building the UI first and bolting the exam rules on later.
* Letting the browser decide time, score, or access.
* Forgetting idempotency on save and submit.
* Huge pull requests nobody can review.
* Testing only on a fast laptop with fast Wi-Fi.
* Logging sensitive data.


Stage 6: Testing and Quality Assurance
Goal
Prove the product works, especially when things go wrong. For a CBT platform, a bug during a real exam is far worse than a bug on a normal website.
Who is involved
QA engineers, all developers, product owner, teachers (for content), and real students (for pilot testing).
The testing pyramid (simple idea)
* Many small unit tests (fast, test one function).
* Fewer integration tests (test pieces working together, such as API plus database).
* A few end-to-end tests (test a whole student journey in a real browser).
* Manual and exploratory testing (humans trying to break it).
Each layer catches different bugs. Do not rely on only one.
6.1 Test planning
* Write a test plan: what is in scope, what is not, which devices and browsers, who tests, how bugs are reported, when testing is complete.
* Write test cases from the acceptance criteria. Each has steps and an expected result.
* Decide severity levels for bugs:
   * Critical: data loss, wrong scores, wrong timers, security leaks, cannot start or submit exam.
   * High: a main feature broken with no workaround.
   * Medium: a feature broken with a workaround.
   * Low: cosmetic issues.
6.2 Unit and integration tests
* Unit tests: scoring functions, shuffle with seed, time calculations, validation rules, blueprint rules, permission checks.
* Integration tests: start attempt, save answers, resume, submit, grade, against a real test database.
* Run them on every pull request automatically.
* Track coverage, but do not chase 100 percent. Cover the critical paths thoroughly (exam engine, grading, payments, permissions, import validation).
6.3 Exam logic and timing tests (the most important tests)
Run each of these automatically where you can, and manually on real phones.
Test
	Expected result
	Timer over a full-length exam
	Matches the server within a second or two
	Tab in the background for 10 minutes
	On return, timer corrects to server time
	Phone sleeps then wakes
	Timer corrects; answers intact
	Device clock moved forward or back
	Server time wins; no extra or lost time
	Refresh mid-exam
	Same question, same answers, correct remaining time
	Close browser, reopen later (time remains)
	Resume correctly
	Close browser, reopen after time ends
	Auto-submitted result is shown
	Double-tap Submit
	One submission, one result
	Submit exactly at zero
	Handled by rules, never both accepted and rejected
	Submit just after zero
	Accepted only within grace; otherwise auto-submit stands
	Student never submits
	Auto-submit happens on time
	Same account on two devices
	Rule applied (blocked or takes over) with a clear message
	Shuffle after refresh
	Order unchanged
	Question edited while attempt in progress
	Attempt unchanged
	Unanswered questions
	Scored per blueprint rules
	Negative marking (if used)
	Correct arithmetic
	Passage questions
	Passage shown with the right questions
	Regrade after key correction
	Scores updated correctly and logged
	Scoring correctness: prepare a handful of known answer sets with hand-calculated scores (all correct, all wrong, half answered, mixed subjects) and assert the system matches exactly.
6.4 Network resilience tests
* Use browser developer tools to throttle to slow 3G and to go offline.
* Cut the connection mid-exam, keep answering, restore it, and confirm everything syncs.
* Make the connection flap on and off while answers are being saved.
* Add delay and packet loss using network tools to simulate Nigerian mobile networks at their worst.
* Test what the student sees: calm status messages, no scary errors, no lost work.
* Test submit with a bad connection: the app retries and the student knows what is happening.
* Test first load on a cold cache and on a warm cache; measure time to first question.
6.5 Content quality tests
* Sample audit every imported batch against the original papers (a random 5 to 10 percent).
* Double-check answer keys for popular subjects with a second subject expert.
* Render checks: maths, chemical formulas, tables, long passages, big images on a small screen.
* Check for broken images, typos, wrong subject or topic tags, wrong year.
* Track the error rate from the audit. Set a limit (for example, more than 1 error in 100 sampled sends the batch back).
6.6 Performance and load testing
Why load test the right way. Normal websites get steady visitors. Exam platforms get spikes: thousands of students press Start at the same minute, then all send autosaves, then many submit at the same time. Test that behaviour.
Steps
1. Write load scripts (k6, Locust or JMeter) that behave like real students: log in, start an attempt, fetch questions, send autosaves every few seconds, flip questions, submit, fetch results.
2. Run in stages: 100 users, 500, 1,000, 5,000, then your target and beyond (find the breaking point).
3. Test the start spike (all users start within one minute) and the submit spike (all submit within one minute).
4. Watch: response times (p95 and p99), error rate, database CPU and connections, cache hit rate, queue lengths, memory, and the autosave success rate.
5. Find the first bottleneck, fix it, and run again. Repeat until the target has comfortable headroom.
6. Run a soak test (moderate load for several hours) to find memory leaks.
7. Test recovery: stop a server instance or the database replica mid-test and check the system recovers without losing answers.
Typical findings: missing indexes, one slow query in the start flow, too many database connections, big payloads, unbounded queues. Fix them.
Frontend performance tests
* Measure with Lighthouse and real devices on slow 3G profiles.
* Targets from Stage 2 (for example, first question visible within the set time, bundle under budget).
* Check memory and battery behaviour on a low-end phone during a long exam.
6.7 Security testing
* Run through the OWASP Top 10: injection, broken authentication, broken access control, security misconfiguration, vulnerable components, and so on.
* Access control tests: can a student read another student's attempt or result by changing an id? Can a student reach admin endpoints? Can a reviewer publish if they should not?
* Answer-key leak tests: inspect network responses in a simulation. There must be no correct answers.
* Scraping tests: can one account pull thousands of questions quickly? Rate limits must stop it.
* Upload tests: bad file types, huge files, files with scripts.
* Input tests: weird characters, very long inputs, scripts in question text, SQL-like strings.
* Payment tests: fake or replayed webhooks, tampered amounts, double events.
* Session tests: token theft, expired tokens, logout really logs out.
* Run automated dependency and container scans. Consider a professional penetration test before a big launch.
6.8 Accessibility, compatibility and usability testing
* Real devices: low-end Android (Tecno, Infinix and itel class), mid-range Android, an iPhone, a school-type laptop.
* Browsers: Chrome, Samsung Internet, Safari, Firefox, Edge. Also check Opera Mini or UC Browser if your analytics show real use.
* Screen sizes from small phones up to desktop; landscape and portrait.
* Accessibility: keyboard only, screen reader checks, zoomed text, contrast.
* Usability sessions with 5 to 8 real students: give tasks, do not help, note confusion.
6.9 Regression testing
Before every release, run the full automated suite plus a short manual smoke list: sign up, log in, practice, start a mock, go offline and back, refresh, submit, view result and review, report a question, pay (sandbox), admin import and publish.
6.10 Bug management
* Every bug report includes: steps to reproduce, expected result, actual result, device and browser, screenshot or video, severity.
* A developer fixes it and adds a test that would have caught it. QA re-tests. Then it is closed.
* Review bug trends weekly. Many bugs in one area means the design or tests need attention.
6.11 User Acceptance Testing (UAT) and pilot
* Run on staging with real students and teachers.
* Give them real tasks. Watch silently. Record issues, time taken, and confusion.
* Run a pilot mock exam with a group (for example 200 to 500 students). Compare real behaviour with load tests.
* Collect feedback with a short survey.
* Product owner and client sign off in writing.
Recommended practices for Stage 6
* Test the failure paths more than the happy path.
* Automate everything repeatable, but keep human testers hunting for surprises.
* Test on real cheap phones. Emulators lie.
* Keep a permanent "things that broke before" regression set.
Common mistakes for Stage 6
* Testing only on a fast laptop on office Wi-Fi.
* Load testing page views instead of real exam behaviour.
* Skipping content audits because the code is "working".
* Closing bugs without adding tests.
* Treating accessibility as optional.
Outputs
Test plan, test cases, automated test suites, load-test scripts and reports, security test report, content audit results, device test matrix, bug list with status, UAT sign-off.
Done checklist
* ☐ Zero known data-loss, wrong-score or wrong-timer bugs
* ☐ Zero open critical or high bugs (low issues documented and accepted)
* ☐ Every row of the exam failure table passes
* ☐ Load test meets the target concurrency with headroom, including start and submit spikes
* ☐ Frontend meets speed and bundle budgets on a throttled low-end phone
* ☐ Security tests found no unresolved high-severity issues; answer keys are never exposed
* ☐ Content audit error rate within the agreed limit
* ☐ Tested on the agreed devices and browsers
* ☐ Pilot exam completed and feedback addressed
* ☐ UAT signed off in writing


Stage 7: Staging and Pre-Production Verification
Goal
Rehearse the real launch in an environment that looks like production, so launch day holds no surprises.
Who is involved
DevOps, QA, tech lead, product owner, a small group of pilot users.
Steps
Step 7.1: Make staging match production.
* Same versions of everything, same configuration style, same type of database and cache, same CDN setup, same security settings.
* Realistic data volume: a production-sized question bank and many fake students and attempts.
* Use anonymised copies of real data if you copy anything from production. Never expose real student data in staging.
Step 7.2: Deploy the release candidate exactly the way you will deploy to production.
* Use the same pipeline and the same scripts. If staging uses a different method, you have tested nothing.
Step 7.3: Run migrations on a copy of production-size data.
* Measure how long they take and whether they lock tables. Long locks can freeze the whole app.
* Use safe patterns: add columns before using them, avoid renaming in one step, make changes backward-compatible so old and new code can run together briefly.
Step 7.4: Run the full regression suite and the smoke list.
Step 7.5: Run a dress-rehearsal exam.
* Invite a large group (internal staff, tutors, pilot students) to take a full mock at the same time.
* Add synthetic load on top if you want a harsher test.
* Watch every dashboard live. Practise reacting: what would you do if autosave failures spiked?
Step 7.6: Test rollback.
* Deploy the new version, then roll back to the old one on staging. Confirm the app, data and active attempts survive.
* Write down the rollback steps and who does them.
* Know your database rollback plan too (usually: forward-fix migrations, backups as last resort).
Step 7.7: Test integrations in sandbox.
* Payments, email, SMS, analytics. Send real test emails and check they arrive in inboxes (not spam).
* Replay payment webhooks to confirm idempotency.
Step 7.8: Test backups. Take a backup and restore it to a clean environment. A backup you have never restored is only a hope.
Step 7.9: Final content and legal review.
* Check typos, instructions screens, error messages, help pages.
* Privacy Policy, Terms of Use, cookie notice, parent or guardian guidance for minors, contact and support details.
* Check SEO basics for public pages: page titles, descriptions, sitemap, robots file, fast loading, social preview cards.
* Confirm analytics events fire correctly and respect consent rules.
Step 7.10: Hold the go or no-go meeting. Review: open bugs, test results, load results, rehearsal results, rollback test, content audit, legal items, support readiness. Everyone says go or no-go, and it is written down.
Recommended practices for Stage 7
* Treat the rehearsal as a real launch: same people, same checklist, same chat channel.
* Time everything (deploy time, migration time, rollback time).
Common mistakes for Stage 7
* Staging that is much smaller than production.
* Never testing rollback.
* Never restoring a backup.
* Skipping the dress rehearsal because "it passed tests".
Outputs
Rehearsal report, migration timings, rollback runbook, backup restore proof, go or no-go record.
Done checklist
* ☐ Staging behaves exactly as production will
* ☐ Migrations run cleanly, with measured timings
* ☐ Rollback tested and documented
* ☐ Backup restore tested
* ☐ Dress-rehearsal exam succeeded under watch
* ☐ Integrations work in sandbox
* ☐ Legal pages and content approved
* ☐ Written go decision


Stage 8: Deployment Preparation
Goal
Get the real (production) world ready: servers, security, monitoring, people, and plans for when things go wrong.
Who is involved
DevOps, backend lead, security lead, support lead, product owner, marketing or communications.
Steps
Step 8.1: Provision production infrastructure.
* Use infrastructure as code (Terraform or similar) so the setup is written down and repeatable, not clicked together by hand.
* Run at least two copies of the backend behind a load balancer, so one failure does not take you down.
* A managed PostgreSQL database with automatic backups, point-in-time recovery, and (when needed) a standby replica.
* Redis, queue workers (separate pools for grading, imports, emails), object storage, CDN.
* Choose a region and CDN with good performance for Nigeria. Check real latency from several Nigerian cities and networks.
* Set autoscaling rules, and plan to pre-scale manually before known peaks (exam seasons, announced mock dates).
Step 8.2: Networking and domain.
* Register and secure the domain (enable registrar lock and two-factor sign-in on the registrar account).
* Configure DNS records. Use a short time-to-live before launch so changes spread quickly.
* Install SSL/TLS certificates with automatic renewal; enable HTTPS redirect and HSTS.
* Set firewall rules: only the load balancer is public; databases and Redis are private and reachable only from the backend.
Step 8.3: Email deliverability.
* Set up SPF, DKIM and DMARC records so verification and reset emails reach inboxes.
* Use a trusted email provider. Send a test to major providers (Gmail, Yahoo, Outlook) and check the spam folder.
* If using SMS, check the cost and the delivery rate in Nigeria; keep a backup provider if it is important.
Step 8.4: Production configuration and secrets.
* Production secrets are unique and stored in the secrets manager. Different from staging.
* Turn off debug mode and verbose errors. Show friendly errors to users; send details to error tracking.
* Remove test accounts, default passwords, sample data, and unused admin routes.
* Set sensible rate limits and request size limits.
Step 8.5: Security hardening.
* Least privilege: each service and person has only the access they need. Two-factor authentication for everyone with admin or infrastructure access.
* Turn on a web application firewall and DDoS protection (many CDNs include these).
* Set security headers (Content-Security-Policy, X-Content-Type-Options, frame protections, referrer policy).
* Review cookies: secure, HTTP-only, same-site.
* Run a final dependency and container vulnerability scan.
* Make sure logs never contain passwords, tokens or full answers.
* Decide who can read production data and how that access is logged.
Step 8.6: Backups and disaster recovery.
* Automated daily backups plus point-in-time recovery for the database. Backups stored in a separate location or account, encrypted.
* Back up uploaded media and configuration.
* Write down the recovery plan: how to restore, who does it, how long it takes (recovery time) and how much data you could lose (recovery point). Practise once.
Step 8.7: Observability: what to watch (build these dashboards).
Area
	What to track
	Exam health
	Active attempts, starts per minute, submits per minute, auto-submits
	Autosave
	Success rate, failure rate, latency (p95, p99)
	Time
	Resume count, timer-correction size, late submits
	Grading
	Queue depth, time to grade, failures
	Imports
	Batch status, errors, queue depth
	Frontend
	Crash-free sessions, JavaScript errors, time to first question by network type
	Infrastructure
	CPU, memory, database connections and load, cache hit rate, disk
	Business
	Signups, payments, conversion, active users
	* Alerts go to a person who will respond: for example, autosave failure rate over a set threshold for 5 minutes; submit errors; grading queue growing; database connections near the limit; error rate spike; site down.
* Add uptime checks from outside your network, including from Africa if possible.
* Create a public status page to communicate problems calmly.
Step 8.8: Support readiness.
* A support channel students can reach quickly (email, WhatsApp business, in-app form). Decide response times.
* A help centre with answers to likely questions: My exam froze. Did my answers save? I paid but my plan is not active. How do I resume?
* Prepared message templates for incidents (what happened, what we are doing, what students should do).
* Train support on how to look up an attempt and what the status flags mean.
Step 8.9: Release planning and incident plan.
* Choose a release time with the lowest traffic. Never release during a major exam window or the night before one.
* Write the release plan: exact steps, who does each, how long, how to verify, how to roll back.
* Write an incident plan: on-call schedule, who can declare an incident, who decides to roll back, who talks to students, how to write a post-incident report.
* Plan a change freeze for the days around big exams (only urgent fixes).
Step 8.10: Prepare the launch communication. Release notes, announcement, social posts, partner and school messages.
For mobile and Windows apps later (checklist):
* Developer accounts for Apple App Store, Google Play, Microsoft Store.
* Store listings: icon, screenshots, description, privacy details, age rating (check rules for apps used by minors).
* Release builds, code signing, crash reporting.
* Beta testing (TestFlight, Google Play internal testing).
* Allow time for store review and possible rejection.
* Plan forced-update behaviour for critical fixes, and keep old app versions working with the API for a while.
Recommended practices for Stage 8
* Write the runbook as if the person using it is tired and stressed. Short steps, no guessing.
* Test your alerts by triggering them on purpose.
* Keep a launch checklist document and tick items off together.
Common mistakes for Stage 8
* Single server, single point of failure.
* Alerts that go to nobody, or too many alerts so people ignore them.
* Emails landing in spam.
* Launching right before a major exam.
* No support plan for panicked students.
Outputs
Production infrastructure, DNS and SSL, secrets in place, dashboards and alerts, backup and recovery plan, runbooks, support materials, release plan, incident plan, communications.
Done checklist (the pre-launch checklist)
* ☐ HTTPS works, domain and DNS correct, certificates auto-renew
* ☐ At least two backend instances behind a load balancer; database backups verified
* ☐ Backups restored successfully at least once
* ☐ Debug off; no test accounts or default credentials; secrets secured
* ☐ Two-factor enabled on all admin and infrastructure accounts
* ☐ Dashboards and alerts live and tested
* ☐ Status page and support channel ready
* ☐ Emails land in the inbox
* ☐ Rollback and incident plans written and understood
* ☐ Legal pages and compliance ready
* ☐ Release time chosen away from major exams; team knows their roles


Stage 9: Deployment (Going Live)
Goal
Release safely, check that it truly works, and be ready to undo it quickly.
Who is involved
DevOps, backend and frontend leads, QA, support, product owner. Everyone on the launch checklist is available and in the same chat channel.
Choosing a deployment method
Method
	How it works
	When to use
	Big bang
	Switch everything at once
	Only for tiny, low-risk changes
	Rolling
	Update servers one at a time
	Normal everyday releases
	Blue-green
	Two identical environments; switch traffic when the new one is ready; switch back if needed
	Major releases with instant rollback
	Canary
	Send 1 to 5 percent of users to the new version first, watch, then increase
	Risky changes; new exam engine behaviour
	Feature flags
	Code is live but the feature is switched on gradually or only for chosen users
	New exam types, new features
	Recommended for EduReach Hub: rolling or blue-green for releases, canary and feature flags for anything touching the exam engine, and a soft launch (for example, JAMB only, or an invited group) before opening everything.
Safe deployment rules for an exam platform
1. Never break active exams. People may be mid-exam during your deploy. Use backward-compatible API and database changes so the old frontend still works with the new backend for a while.
2. Database changes in two steps: first add things (new columns, new tables) and deploy code that can work with both; later remove old things after all old code is gone.
3. Do not deploy during peak hours or just before a big exam.
4. Avoid restarting workers that are grading without letting jobs finish (graceful shutdown).
5. Keep the auto-submit job running across deployments. Test this.
6. Version the frontend and API so old cached frontends do not break. Show a gentle update available message and never force-reload during an exam.
The go-live sequence
1. Pre-checks: staging passed, go decision recorded, team present, alerts on, backups fresh, rollback ready, status page prepared.
2. Tag the release in version control (for example v1.0.0) and note the previous version for rollback.
3. Run the pipeline from the tagged commit: build, test, create the release artifact.
4. Run database migrations (backward-compatible, with timings you measured in staging).
5. Deploy the backend (rolling, blue-green or canary). Watch health checks.
6. Deploy the frontend and clear or version the CDN cache.
7. Run smoke tests on production immediately:
   * Sign up and log in
   * Start a practice session; answer; see feedback
   * Start a short mock exam; answer; refresh the page; confirm resume with the right time
   * Go offline for 30 seconds while answering; reconnect; confirm sync
   * Submit; confirm the result appears
   * Open review mode; report a question
   * Make a small real payment (and refund it) if payments are live
   * Admin: log in, import a tiny file, review, publish, then retire it
8. Watch dashboards closely for the first hour: error rate, autosave failures, submit latency, queue depth, database load.
9. Increase exposure gradually if using canary or flags.
10. Announce the launch only when metrics look healthy.
11. Keep the team on standby for the first day (and on-call for the first weeks).
When to roll back
Roll back immediately if you see any of these: autosave failures above the threshold, wrong scores, timers misbehaving, submit failures, mass login errors, unexplained data problems, or database trouble. Rolling back is a normal tool, not a failure. The person who decides is named in the incident plan.
Recommended practices for Stage 9
* Have one person drive the release and one person watch the metrics. Do not do both.
* Write timestamps in the release channel as you go (useful for the later review).
* Do the smoke tests with a real phone on mobile data, not just office Wi-Fi.
Common mistakes for Stage 9
* Deploying on a Friday evening or before an exam.
* Running a migration that locks the main table.
* Announcing before checking.
* No one assigned to watch the metrics.
* Forgetting to test rollback and then needing it.
Outputs
Live release, tagged version, smoke test results, launch log.
Done checklist
* ☐ Production smoke tests pass
* ☐ Error rates, autosave success, submit success, and speed are normal
* ☐ A real test attempt works end to end on mobile data
* ☐ No critical alerts firing
* ☐ Active exams were not disturbed
* ☐ Release tagged and recorded
* ☐ Launch communication sent after checks passed


Stage 10: Post-Launch Monitoring (Hypercare)
Goal
The first days and weeks after launch are the riskiest. Watch closely, fix fast, and learn from real students.
Who is involved
Everyone: developers on call, DevOps, support, product owner, content reviewers.
Steps
Step 10.1: Run a hypercare schedule.
* First 24 hours: the team is on standby and watching dashboards.
* First 1 to 2 weeks: daily short check-in meeting (what broke, what students are saying, what is next).
* Keep the on-call rota running, with a clear escalation path.
Step 10.2: Watch the technical metrics.
* Autosave success rate, submit success rate, submit and save latency (p95, p99), resume rate, auto-submit count, grading queue time.
* Crash-free sessions, JavaScript errors by device and browser, time to first question by network type.
* Database load and slow queries, cache hit rate, cost per day.
* Look for patterns: one phone model failing, one network slower, one subject slow to load.
Step 10.3: Watch the product metrics (compare with Stage 1 goals).
* Signups, activation (completed a first practice or mock), exam start-to-completion rate, abandonment point, 7-day return rate, paid conversion.
* Where do students drop off? Fix that screen first.
Step 10.4: Watch the content quality metrics.
* Reports per 1,000 questions served; the most-reported questions; reports by subject and by import batch.
* Fix reported errors quickly and visibly. A fast correction builds trust.
* If a batch has a high error rate, pause the batch and audit it.
Step 10.5: Handle bugs as hotfixes, safely.
* Triage: severity first. Critical (data loss, wrong scores, broken timer) means stop everything.
* Make the smallest safe fix, add a test, review it, deploy through the normal pipeline (faster, but never skipping checks).
* Tell affected students clearly and kindly. If scores were wrong, regrade and notify.
Step 10.6: Collect feedback.
* Support tickets, app reviews, short in-app surveys, teacher feedback, social media mentions.
* Tag every piece of feedback (bug, content, idea, confusion) and review weekly.
Step 10.7: Watch the cost. Bandwidth, database, storage, email and SMS, and payment fees. Adjust before a surprise bill arrives.
Step 10.8: Hold a retrospective after the first two weeks (and after each exam season).
* What went well? What went badly? What surprised us? What will we change?
* For incidents, write a blameless post-mortem: timeline, cause, impact, what worked, what to change, who owns each action. The goal is learning, not blaming.
Step 10.9: Hand over to the maintenance rhythm once things are stable (agreed period, for example 2 weeks with no critical incident).
Recommended practices for Stage 10
* Share a simple daily summary with the whole team.
* Keep a running known issues list and publish it to support.
* Fix what students feel first (speed, lost progress, confusing screens).
Common mistakes for Stage 10
* Everyone goes home after launch.
* Ignoring small reports that point to a bigger bug.
* Hotfixing without tests and causing a second bug.
* Not telling students what happened.
Done checklist
* ☐ Stable for the agreed period with no critical incidents
* ☐ Success metrics are tracked against the Stage 1 goals
* ☐ Top feedback items triaged and planned
* ☐ Retrospective held and actions assigned
* ☐ Support and maintenance handover complete


Stage 11: Maintenance and Continuous Improvement
Goal
Keep the platform correct, fast, secure and useful as exams, students and technology change.
The yearly rhythm for an exam platform
When
	What to do
	Before each exam season
	Freeze risky changes, load test, pre-scale, refresh content, review alerts, brief support
	During the season
	Heightened monitoring, urgent fixes only, fast question corrections
	After the season
	Retrospective, cost review, clean-up, plan improvements
	Quiet months
	Big features, refactoring, new exam types, dependency upgrades, disaster-recovery drill
	Ongoing work
Content operations (never ends).
* Add new past papers each exam year; keep official formats up to date (re-check the exam bodies' announcements regularly and update blueprints).
* Keep reviewing reported questions; retire outdated or disputed ones.
* Improve topic and syllabus tagging; add explanations and worked solutions.
* Keep your reviewer team trained and your review rules current.
Security and updates.
* Update dependencies on a schedule (monthly) and immediately for serious vulnerabilities.
* Patch servers and containers; rotate secrets; review admin access and remove people who left.
* Re-run security scans; consider a yearly penetration test.
* Keep up with data-protection rules and update your Privacy Policy when practice changes.
Reliability and performance.
* Review monitoring trends monthly: slow queries, growing tables, rising costs, slow screens.
* Archive old data safely when needed (for example, very old attempt answers) while keeping results.
* Add indexes and caches where data growth demands it.
* Run load tests before each season and after major changes.
* Drill disaster recovery at least twice a year (restore from backup; fail over).
Product improvement.
* Use real data to decide features: where students struggle, what they ask for, what they pay for.
* Candidate features: adaptive practice (more questions from weak topics), study plans, streaks, leaderboards, timed challenges, school and teacher dashboards, explanation videos, offline question packs, native mobile and Windows apps.
* Every new feature follows the same lifecycle (requirements, design, build, test, stage, deploy, monitor), just in a smaller loop.
Versioning and documentation.
* Use semantic versioning (major.minor.patch) and keep a changelog.
* Announce API changes early; keep old versions working for a time.
* Keep the README, runbooks, API docs, data model, decision log and onboarding guide up to date. Out-of-date docs mislead new developers.
Team health.
* Rotate on-call fairly, review incidents, keep a list of learning topics, hold regular code-quality sessions, pair junior and senior developers.
End of life. If a feature or product is ever retired: warn users early, let them export their data, delete data properly, and shut down infrastructure cleanly.
Done checklist (recurring)
* ☐ Dependencies and servers patched on schedule
* ☐ Load test and pre-scale done before every exam season
* ☐ Exam blueprints match the latest official formats
* ☐ Reported questions fixed within the agreed time
* ☐ Backup restore and disaster-recovery drills done
* ☐ Documentation reviewed this quarter


Suggested Roadmap
Phase
	What is included
	MVP
	Accounts; JAMB full simulation and practice mode for core subjects; server-controlled timer; autosave, offline queue and resume; grading, results and review; admin import, review and publish; responsive PWA; monitoring and backups
	Phase 2
	WAEC and NECO blueprints; progress analytics and weak-topic practice; question reporting loop; payments and plans; performance and scale hardening; support tooling
	Phase 3
	Post-UTME by institution; school and teacher features; downloadable offline question packs; native mobile and Windows apps; adaptive learning
	

Top Risks and What to Do About Them
Risk
	Why it matters
	Defence
	Wrong questions or answer keys
	Destroys trust faster than any bug
	Review workflow, two-person rule, sampling audits, fast student reports, regrade tool
	Lost answers or wrong timers
	The core promise of the product
	Server time, local save, idempotent sync, resume, exhaustive failure tests
	Peak-season traffic spikes
	Everyone practises at the same time
	Load test real behaviour, pre-scale, queues, back-pressure
	Content licensing
	Legal and reputation risk
	Resolve sourcing early; keep source records per question
	Scraping of the question bank
	Your main asset
	Auth, rate limits, limited batches, monitoring
	Heavy pages on cheap phones and data plans
	Students leave
	Bundle budgets in CI, lazy loading, real-device tests
	Student data and minors
	Legal and ethical duty
	Data minimisation, clear consent, NDPA compliance with legal advice
	Over-engineering
	Slow delivery, high cost
	Modular monolith first; scale only what metrics show
	Releasing at the wrong time
	Breaks live exams
	Change freezes, off-peak deploys, backward-compatible changes
	

Master Pre-Release Checklist (the final "are we really done?" list)
Product
* ☐ All MVP features complete and matching acceptance criteria
* ☐ UAT and pilot exam signed off
Exam engine
* ☐ Server-controlled time verified
* ☐ Autosave, offline queue, resume, double-submit and auto-submit all tested
* ☐ Grading verified against hand-calculated scores; regrade tool works
* ☐ Snapshot and versioning prove old attempts never change
Content
* ☐ Question bank audited; answer keys double-checked for key subjects
* ☐ Review, approval and publish workflow in use; audit log working
* ☐ Report-a-question loop live
Quality and performance
* ☐ No open critical or high bugs
* ☐ Cross-device and cross-browser tested, including low-end Android
* ☐ Load tested with start and submit spikes; headroom confirmed
* ☐ Bundle and speed budgets met on throttled networks
Security and compliance
* ☐ Vulnerability scans clean; access control and answer-key leak tests passed
* ☐ HTTPS, secure cookies, rate limits, two-factor on admin accounts
* ☐ Privacy Policy, Terms, consent, and minors handling in place
Infrastructure and operations
* ☐ Production provisioned with redundancy; DNS and SSL done
* ☐ Backups running and restore tested
* ☐ Monitoring, dashboards and alerts live; on-call rota set
* ☐ Rollback and incident plans tested and written
* ☐ Status page and support channel ready
Documentation and communication
* ☐ README, API docs, data model, runbooks, release notes up to date
* ☐ Support team briefed; launch announcement ready


A Learning Developer's Survival Habits
1. Read the acceptance criteria twice before writing code. Ask when unsure.
2. Make small changes. Small branches, small pull requests, small commits.
3. Test the unhappy path. Ask: what if the network drops, the user refreshes, the data is empty, the request repeats?
4. Never trust the browser. Time, scores, permissions and answer keys belong to the server.
5. Never trust input. Validate everything on the server, including data from admins.
6. Never put secrets in code or chat.
7. Make saves safe to repeat (idempotent).
8. Write a test with every bug fix.
9. Measure before optimising. Use real tools on real phones.
10. Leave notes for the next person: clear names, comments that explain why, updated docs.
11. Ask for review early and accept feedback as free teaching.
12. When production breaks, stay calm. Roll back first, investigate second, write the post-mortem third.


Keep this guide alive. When you learn something new from a bug, a test or a launch, add it here so the next developer starts one step ahead.