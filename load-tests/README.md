# EduReach Hub k6 load tests

These tests target the deployed EduReach Hub application.

## Prerequisite

Install k6:

```powershell
winget install k6.k6
```

Verify:

```powershell
k6 version
```

## Smoke test

From the repository root:

```powershell
k6 run load-tests/smoke.js
```

Default target:

```
https://edureachhub.netlify.app
```

You can override the target without editing the script:

```powershell
k6 run -e BASE_URL=https://your-test-url.example.com load-tests/smoke.js
```

## Staged load test

Start with the staged test:

```powershell
k6 run load-tests/load.js
```

It ramps through:

10 -> 25 -> 50 -> 100 virtual users

and then ramps back down.

## Important

Do not jump directly to thousands of users against production. First verify the smoke test and staged test, then increase the workload deliberately.

The next iteration should add realistic EduReach journeys, especially authentication, dashboard, CBT question retrieval, answer saving, submission, and results. Those endpoints should be identified from the current application code before adding them to the test.
