# EduReach Service Map

src/data/services.ts is the product directory for service names, categories, routes and visual identity.

Supabase public.service_catalog remains the runtime catalogue for currently active services, descriptions, prices and external portal links.

## Rule

A page must not create its own service list.

When a service is introduced:
1. Add its product definition to src/data/services.ts.
2. Add its runtime row to service_catalog only when the backend capability exists.
3. Reuse getServiceDefinition() for metadata.
4. Reuse CardIdentityMark and cardTheme.ts for visual identity.
5. Add a route only when a real page exists.
6. Do not advertise an unimplemented route merely by adding a data row.

This separation lets the product directory be planned in phases without pretending that every future service is already operational.
