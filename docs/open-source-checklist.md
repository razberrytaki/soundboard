# Open Source Checklist

## Purpose

This checklist captures the minimum release gate before publishing the repository publicly.

## Sensitive Information

- [x] Remove project-specific custom domain configuration from `wrangler.jsonc`
- [x] Verify the current tree does not contain `.env` files, private keys, certificates, or API tokens
- [x] Verify the public `main` history no longer contains the removed custom domain
- [x] Delete local-only backup branches that preserve pre-public history once no longer needed

## Code Quality

- [x] `pnpm test`
- [x] `pnpm lint`
- [x] `pnpm build`
- [x] `pnpm exec opennextjs-cloudflare build`
- [x] `pnpm audit --audit-level=moderate`
- [x] Fix known user-facing data loss issues before release

## Documentation

- [x] Add a public `README.md`
- [x] Add a `LICENSE` file
- [x] Replace internal planning artifacts with a public architecture document
- [x] Ensure public docs reflect the current repository structure
- [ ] Add contribution guidelines beyond the brief README section if outside contributions become active

## Deployment

- [x] Keep `wrangler.jsonc` fork-friendly
- [x] Confirm Cloudflare Workers build and deploy commands
- [x] Keep custom domains managed outside the public repository by default
- [ ] Re-check the active Cloudflare production deployment after the latest push

## Optional Nice-to-Haves

- [ ] Add CI for `test`, `lint`, and `build`
- [ ] Add a dedicated issue template and pull request template
- [ ] Add screenshots or a short demo section to `README.md`
- [ ] Add a more explicit browser support policy
