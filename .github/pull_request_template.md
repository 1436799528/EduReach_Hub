<!--
Keep this short. A reviewer should know what changed, why, and how to check it
without reading the diff first. See CONTRIBUTING.md and the working guide.
-->

## What changed

## Why

<!-- Link the story, the feature contract in docs/features/, or the bug it fixes. -->

## How to verify

<!--
Exact steps a reviewer can follow, and the commands you ran.
-->

## Tests

- [ ] Unit/integration test that fails without this change
- [ ] `npm run lint`, `npm test`, `npm run build` run locally
- [ ] Checked on a phone-sized screen (and with network throttling if it touches
      the exam routes)

## Risk and rollback

<!--
What could break, who is affected, and how to undo it. Say "none" when true.
-->

## Checklist

- [ ] No secret, key or credential added to the repository
- [ ] No applied migration edited; any schema change is a new migration
- [ ] No new dependency, schema change, or architecture change without owner
      approval
- [ ] Docs updated when routes, schema, configuration or behaviour changed
- [ ] Loading, empty, error and offline states handled where the screen has them
- [ ] No test deleted or weakened to make the gate pass
