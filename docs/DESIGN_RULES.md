# EduReach Design Rules

EduReach is a Nigerian student-information and student-services hub combining practical services, examination preparation, academic tools, information and a student account workspace.

## Rules

1. One visual language across public, student and service pages.
2. Reuse existing HubLayout, CardIdentityMark, cardTheme.ts and current global CSS before creating a new visual primitive.
3. Cards stay compact, information-dense and actionable. Avoid oversized dashboard templates.
4. Brand identities such as JAMB, WAEC, NECO, NABTEB and NELFUND use their brand marks. EduReach-owned tools use EduReach service icons.
5. Never create a second service-card style.
6. Reuse established typography, spacing, buttons, status badges and responsive breakpoints.
7. Mobile uses the same components and data as desktop.
8. Loading, empty, error and success states use the shared visual language.
9. Never duplicate service definitions inside a page.
10. Do not hard-code a service route when it already exists in the service directory.
11. Authentication and authorization are separate concerns. Server authorization remains authoritative.
12. Admin student-view is a mode of the existing student workspace, not a second application.
13. External official portals must be clearly identified as external.
14. Never collect passwords, OTPs, card PINs or banking credentials in EduReach forms.
15. Database-backed features require a table/API/RLS contract before a page is added.
