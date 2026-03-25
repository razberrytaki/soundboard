# Contributing

Thanks for taking the time to contribute to Soundboard.

## Before You Start

- Use Node.js `24.13.0`
- Use pnpm `10.28.0`
- Install dependencies with `pnpm install`
- Start the app locally with `pnpm dev`

This project is intentionally backend-free. Most feature work happens in the App Router UI, IndexedDB repository layer, and local browser playback code.

## Preferred Workflow

1. Branch from `main`
2. Keep the branch focused on one feature, bugfix, or documentation change
3. Run the local verification commands before opening a pull request
4. Open a PR against `main`
5. Merge only after review and green CI

The production deployment flow is tied to `main`, so feature branches should stay unmerged until verification is complete.

## Local Verification

Run the following commands before opening a PR:

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec opennextjs-cloudflare build
```

If your change touches docs only, still verify the commands that are relevant to any edited code paths before asking for review.

If you need a local coverage report while working, run:

```bash
pnpm test:coverage
```

## Scope Guidelines

- Keep changes small and reviewable
- Prefer fixing one problem per pull request
- Update tests when behavior changes
- Update docs when setup, workflows, or user-visible behavior changes
- Avoid adding new dependencies unless the benefit is clear and documented

## UI and UX Changes

- Preserve the existing visual language unless the change is intentionally redesigning a specific area
- If you change the UI materially, update the README screenshots or include fresh screenshots in your PR
- Document browser-specific behavior when a change depends on IndexedDB, media playback, or file handling

## Pull Request Expectations

Each PR should explain:

- what changed
- why the change is needed
- how it was tested
- whether any follow-up work is still out of scope

Use the PR template as the default structure.
