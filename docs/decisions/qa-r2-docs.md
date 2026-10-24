# qa-r2-fix-docs — decisions

Both items wait on the user. Nothing in README.md's links or licence paragraph was changed: each change below
depends on an answer only the user can give.

## DOC-R2-1 — no licence for the project's own code and content

Reproduced (2026-10-23): no `LICENSE*` or `COPYING*` at the root, no `license` field in package.json, and README.md
"Credits and licences" ends "no licence for its own code and content yet, so all rights are reserved by the author
until one is added". The About panel (`src/ui/aboutpanel.js` `credits`) lists only the bundled code's licences.
No third-party code or asset is committed (node_modules/ and dist/ are ignored), so the licence covers only the
author's own work.

- **No licence chosen; the README paragraph is left as is.** — choosing a licence is the user's call. The paragraph
  is accurate for the current state. Alternative: pick a default, which would grant rights the user never chose to grant.
- **Options to put to the user:**
  - *One permissive licence for everything*: MIT (short) or Apache-2.0 (adds an explicit patent grant and asks
    redistributors to keep a NOTICE). package.json `"license": "MIT"` / `"Apache-2.0"`.
  - *Split code and content*: MIT or Apache-2.0 for the code; CC BY 4.0 (credit required) or CC BY-SA 4.0 (credit, and
    derivatives under the same terms) for the content. Creative Commons advises against its licences for software,
    which is why the code gets its own. The README must say where the line falls. Suggested: content is docs/**,
    README.md, public/og-image.jpg and the prose and source lists in src/data/**; everything else is code.
    package.json `"license": "(MIT AND CC-BY-4.0)"` (SPDX expression).
  - *Copyleft code* (GPL-3.0 or AGPL-3.0), if derivatives must stay open. AGPL also covers people who host a modified
    copy.
  - *All rights reserved on purpose*: no LICENSE file, package.json `"license": "UNLICENSED"`, and the README sentence
    loses "yet" and "until one is added". On GitHub, others may still view and fork the repo there (GitHub's Terms of
    Service), but may not reuse it.
- **After the decision:** add `LICENSE` (and `LICENSE-content` if split) with the standard text from SPDX/choosealicense
  and the copyright line the user gives (year and name; the git author name is the handle `ethanpil`). Replace the
  last paragraph of README "Credits and licences". Ask core for the package.json field and ui for a line in the About
  panel credits. Record the choice here.

## DOC-R2-2 — GitHub owner/repo and the commit author email, before the first push

Reproduced (2026-10-23): `git remote -v` is empty, `gh repo view ethanpil/mikdash` gives "Could not resolve to a
Repository", and README.md hard-codes `https://ethanpil.github.io/mikdash/` in three links (line 11 live site, line 71
example, line 125 licence texts). `git log` shows 25 commits, every one with the user's personal address as author and
committer. It is set in both ~/.gitconfig and this repo's .git/config. No tracked file contains the address
(`git grep`).

- **The URLs are kept until the owner and name are confirmed.** — They are right if the repo is published as
  `ethanpil/mikdash`. The active `gh` account is `ethanpil`, there is no `ethanpil.github.io` user-site repo (so no
  custom domain redirects project sites), and vite.config.js `base: './'` works under any subpath. Nothing else
  hard-codes the host: share cards take `actions/configure-pages`' `base_url` at deploy (qa-r1-core.md). If the owner,
  name or domain differ, change those three lines only. Alternative: drop the links until the repo exists, which would
  leave the README without a live link on the day it goes public.
- **CLAUDE.md "Tools" now says the README holds the Pages address in three links.** — It is the one place the address
  does not follow the deploy. A rename or a custom domain later would otherwise leave dead links.
- **Email, for the user to decide (not changed here):** a public repo shows every commit's author and committer
  address. GitHub's "Block command line pushes that expose my email" checks the author email of the most recent pushed
  commit. If it is on, the first push is rejected. Whether it is on cannot be read here: the API needs the `user` scope,
  and the gh token was not widened. The profile email is not public (`gh api user`: `email: null`).
  - *Keep the address*: push as is.
  - *Future commits only*: set this repo's `user.email` to the GitHub noreply address. The local .git/config overrides
    the global one. The account dates from 2010, so the address is `ethanpil@users.noreply.github.com` or the ID-based
    `<id>+ethanpil@users.noreply.github.com`; copy the exact one from Settings > Emails. Earlier commits still expose
    the personal address.
  - *Rewrite history*: replace the author and committer email on all commits, e.g. `git filter-repo --mailmap`. Since
    nothing has been pushed or cloned, rewriting now costs nothing; after the first push it changes every hash under
    anyone's clone.
- **Pages before the first push.** — `configure-pages` runs without `enablement: true` (which would need a token other
  than GITHUB_TOKEN), so Settings > Pages > Source must be **GitHub Actions** first. Otherwise the first run fails at
  that step. Then re-run it from the Actions tab (the workflow has `workflow_dispatch`). The README "Deploying" section
  already says this. Pages on GitHub Free needs a public repo.
