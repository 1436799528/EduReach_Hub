# EduReach Functional QA Gate

EduReach pages are complete only when the UI, route, interaction, data, authentication, and error/empty states work together.

## Functional standard

- If an element looks clickable, it must perform a real action.
- If a page exists, its route and direct URL must work.
- If a feature is displayed, its state/data path must be connected or have a clear empty/error state.
- Public pages introduce EduReach services; authenticated dashboard pages manage the student's personal activity.

## Page functionality checklist

Before marking a page complete, verify:

- [ ] Route works
- [ ] Direct URL works
- [ ] Navigation works
- [ ] Back/forward works
- [ ] All links lead to valid routes or external destinations
- [ ] All buttons perform their intended action
- [ ] All clickable cards open the correct page/service
- [ ] Functional icons perform an action; decorative icons are not presented as controls
- [ ] Forms validate, submit, and show success/error states
- [ ] Search/filter controls actually filter results
- [ ] Loading state works
- [ ] Empty state works
- [ ] Error state is useful
- [ ] Authentication behavior is correct
- [ ] Protected pages redirect unauthorized users to login with `next`
- [ ] User-specific information is not hardcoded when authenticated data exists
- [ ] Mobile drawer/navigation works
- [ ] No dead UI or placeholder-only functionality
- [ ] No broken imports/assets
- [ ] No console/server errors during the flow

## Route ownership

### Public routes

Public routes introduce services and tools:

- `/`
- `/services`
- `/admission`
- `/cbt`
- `/past-questions`
- `/nelfund`
- `/scholarships`
- `/results`
- `/news`
- `/events`
- `/schools`
- `/tools`
- `/login`
- `/register`

### Protected student routes

Protected routes manage account activity:

- `/dashboard`
- `/dashboard/services`
- `/dashboard/applications`
- `/dashboard/cbt`
- `/dashboard/cbt/results`
- `/dashboard/past-questions`
- `/dashboard/saved`
- `/dashboard/scholarships`
- `/dashboard/notifications`
- `/dashboard/tools`
- `/profile`
- `/settings`

## Architecture rule

The homepage introduces and provides access to EduReach services. The dashboard manages the student's personal activity within those services.
