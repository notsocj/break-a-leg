# Maintainer guide

## Validate a change

Use Node 22.18+ (24 LTS recommended), npm, Python 3, and Git. Development type-checking dependencies are pinned in the lockfile; installed skill users do not need them.

```sh
npm ci --ignore-scripts
npm run bundle
npm run typecheck
npm run check:bundle
npm run check:docs
npm test
npm run test:python
npm run demo
git diff --check
```

The HTTP suite and demo bind loopback only. The Python suite covers installer and release packaging behavior. `npm run test:installer` remains available for only the installer tests. Documentation checking verifies local file destinations, not remote website availability or Markdown fragment anchors.

If guidance changes a security decision, use a relevant [manual evaluation](../evals/local-first/request.md). Give the evaluator the request and raw fixture, withhold the rubric, and record the evaluator/model and limitations. Do not label an unevaluated scenario as passed.

Keep private app reports, tokens, and source copies outside this public repository. Synthetic examples should be self-contained and omit customer identifiers or copied private evidence.

## Prepare a version

1. Review the complete diff and the final tracked file list for private material.
2. Update `package.json`, both root version entries in `package-lock.json`, and `runner/version.ts` together. Run `npm run bundle` to refresh the bundled version. Do not change historical example report versions to pretend they were rerun.
3. Add dated release notes to `CHANGELOG.md`; keep unreleased maintenance notes under `Unreleased`. Update README's current version and `VERIFICATION.md` with checks actually performed and remaining limits.
4. Run the validation above. Test the installable folder outside the repository; automated packaging tests exercise this for the helper.
5. Commit only reviewed source changes. Never move an existing published version tag to new content.

## Build archives

Use a clean Git checkout of the exact intended release commit. `scripts/package.py` requires the repository's Git root; packaging an extracted source ZIP is unsupported. It selects Git-tracked files only, excludes known local/dependency/credential artifacts, and rejects symlink paths. This is a packaging boundary, not a general secret scanner: a private value deliberately committed to an ordinary source file still needs review.

Choose an output directory outside the repository:

```sh
python3 scripts/package.py --out ../break-a-leg-release
```

The script creates `break-a-leg-v<version>-source.zip` and `break-a-leg-v<version>-skill.zip`. Both contain a `break-a-leg/` top-level directory. The standalone archive contains only the installable skill. Existing destination archives are refused; choose a new output directory rather than overwriting a published artifact.

List the archive contents, confirm expected files, and verify the copied skill's `--version`. Compute checksums using your host's SHA-256 tool if distributing the ZIPs. Inspect for private material before uploading any artifact; untracked file exclusion does not replace review of committed files.

## Publish and verify

Push the reviewed commit and a new matching version tag to the intended remote, without force-pushing an existing tag. Verify both remote refs point to the intended commit and that GitHub Actions passes on Node 22 and 24. A tag and a GitHub Release page are separate: publish a Release page/assets only when intentionally preparing that distribution.

Release notes should explain changes, compatibility/schema changes, validation, and known limits. They must not include findings from private app reviews. Keep the [security reporting channel](../SECURITY.md) usable.

If a release has a defect, publish a follow-up patch. To recover an installed skill locally, use the backup path printed by the explicit-update installer after preserving any newer customizations.
