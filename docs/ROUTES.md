# EduReach Routes

Routing remains centralised through src/HubApp.tsx during the foundation phase. Do not create another router.

## Current routes
- / 
- /services
- /services/track
- /services/apply/:slug
- /services/:slug
- /cbt
- /cbt/practice
- /cbt/results
- /screening-calculator
- /news
- /news/:slug
- /jobs
- /login, /signin
- /register, /signup
- /forgot-password
- /dashboard
- /dashboard?view=student
- /admin
- /admin/queue
- /admin/cbt
- /admin/vouchers
- /admin/users

Unknown routes currently return the homepage. Do not add page-specific fallback routing.
