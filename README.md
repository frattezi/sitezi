# sitezi

Personal website of **Pedro Frattezi Silva** — a landing page and a markdown blog.

Two URLs matter:

- `/` — who I am, what I do, how to reach me
- `/blog` — posts, written in markdown, committed as files

Everything here is boring on purpose: static HTML out, no runtime, no database, no CMS, no
client-side framework. A post is a `.md` file; publishing is a `git push`.

> **Status: built, not deployed.** The site builds, typechecks, lints and renders locally, and
> `wrangler deploy --dry-run` accepts the config. It is not on Cloudflare yet and has no domain, so
> `infra/` is deliberately inert. Analytics is wired but only activates where a project token is
> set.

---

## Stack

| Piece | Choice | Version | Why |
| --- | --- | --- | --- |
| Framework | [Astro](https://astro.build) | 7.x | Markdown is a first-class input, not a plugin. Ships **zero JS by default** — a blog needs no hydration, so this is a static HTML file per page for free. Islands are available if one page ever needs interactivity. |
| Styling | [Tailwind CSS](https://tailwindcss.com) | 4.x | Utilities only, no design system to maintain. Compiled by `@tailwindcss/vite` — **not** the deprecated `@astrojs/tailwind` integration. |
| Typography | `@tailwindcss/typography` | 0.5.x | The `prose` class styles raw markdown output, which is otherwise unstyled. Loaded as a CSS plugin, not an integration. |
| Content | Astro Content Layer | — | Collections declared in `src/content.config.ts` with a Zod schema. A typo'd frontmatter field **fails the build** instead of shipping broken HTML. |
| Language | TypeScript | strict | `astro/tsconfigs/strict`, no `any`. |
| Hosting | Cloudflare Workers (Static Assets) | — | Free, unlimited static requests, global CDN, and Workers is where Cloudflare is consolidating. No server to pay for. |
| Infra | [Pulumi](https://www.pulumi.com) | 3.x | The Cloudflare zone and custom domain as TypeScript — same language, same typechecker, same package manager as the site. See [Deploy](#deploy) for what it does and does not own. |
| Analytics | [PostHog](https://posthog.com) | — | Pageviews and referrers. One inline script, rendered only when a token is configured, with memory-only persistence so there is no cookie and nothing to consent to. The single exception to "no client-side JS". See [Analytics](#analytics). |
| Repo | GitHub | — | `frattezi/sitezi` |

### Choices rejected, and why

- **Next.js / Nuxt / SvelteKit.** They solve hydration for interactive apps. A blog runs no
  component code in the browser, so the whole runtime would be dead weight. Astro can render the
  same components as islands later, without the upfront cost.
- **Hugo.** Genuinely faster builds, but Go templates make any custom layout a fight, and build
  speed is irrelevant at this post count.
- **Eleventy.** Fine, but it leaves routing, layouts and the markdown pipeline for me to assemble.
  Astro already did that work.
- **Cloudflare Pages.** Merged into Workers. New projects should use Workers Static Assets;
  Pages remains for existing ones. Static asset requests are billed identically (free).
- **S3 + CloudFront.** I know how to do it. Hosting HTML does not need an ACM cert, an origin
  access control, and a cache invalidation strategy.
- **Terraform (HCL).** The same Cloudflare provider Pulumi wraps, so the resources and their
  semantics are identical. The only thing HCL buys is a second language and a second toolchain in
  a repo that is already TypeScript end to end. Pulumi's TypeScript SDK is that provider with types.
- **A headless CMS.** The CMS is `git`. A markdown file in the repo is the draft, the review, the
  history and the publish step in one.

---

## Requirements

- **Node >= 22.12** (Astro 7's floor). Developed on Node 24.
- npm (lockfile committed; do not mix package managers).
- **Pulumi CLI**, for `infra/` only: `brew install pulumi/tap/pulumi`.
- **A PostHog project token**, only if analytics should run locally. Optional — without it the site
  builds fine and ships no analytics script at all.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server on http://localhost:4321 with hot reload
npm run build        # static build to ./dist
npm run preview      # serve ./dist locally — check this before pushing
npm run check        # astro check: TypeScript + content schema validation
npm run lint         # eslint, includes accessibility rules
npm run format       # prettier write (prettier-plugin-astro)
```

`check` and `lint` must pass before a commit. `build` must pass before a push.

Infrastructure is a second, separate npm project in `infra/`:

```bash
cd infra && npm install   # after changing infra/package.json
npm run typecheck         # tsc --noEmit — the infra program is typechecked like any other TS
npm run preview           # pulumi preview — show the diff, create nothing
npm run up                # pulumi up
```

## Project structure

```text
src/
  content.config.ts        # Zod schema for every collection — the content contract
  content/
    blog/                  # one markdown file per post; filename = URL slug
  layouts/
    Base.astro             # <html>, <head>, skip link, header/footer. Every page uses it.
  components/
    PostHog.astro          # analytics — the only client-side script, and it is conditional
  lib/
    posts.ts               # the ONE place posts are queried and drafts are filtered out
    site.ts                # author name and the default description
  styles/
    global.css             # Tailwind entry + @theme design tokens
  pages/
    index.astro            # /
    404.astro              # dist/404.html, served by wrangler's not_found_handling
    blog/
      index.astro          # /blog — post listing
      [...slug].astro      # /blog/<slug> — post page
public/                    # static files copied verbatim (favicon)
wrangler.jsonc             # Cloudflare Workers config: serves ./dist as static assets
infra/                     # Pulumi program — the Cloudflare *account* layer
  Pulumi.yaml              # project definition
  Pulumi.dev.yaml          # stack config; created by `pulumi stack init`, committed
  index.ts                 # the custom domain bound to this site's Worker
```

Rule of thumb: `pages/` routes and fetches data, `layouts/` wraps, `components/` renders markup it
was handed. Anything that queries content lives in `lib/`. Everything under `infra/` describes
Cloudflare, not the site.

## Writing a post

Create `src/content/blog/<slug>.md`. The filename **is** the URL: `hello-world.md` becomes
`/blog/hello-world/`.

```markdown
---
title: Keeping Astro boring
description: One sentence. Used in the blog listing and as the meta description.
pubDate: 2026-01-15
draft: false
---

Body in markdown. Headings start at `##` — the layout already renders the `h1`.
```

Frontmatter is validated by the schema in `src/content.config.ts`. Adding a field there is what
makes it available to every page; adding it only to a post fails the build.

- `draft: true` keeps a post out of the listing, the sitemap and the build entirely. Write in the
  open; the flag is the publish switch.
- Posts are sorted by `pubDate`, newest first.
- Then: `npm run dev` to read it, `npm run build`, commit, push. Deploy is automatic.

## Deploy

Two declarative layers, and every resource has exactly one owner. Blur the line and the two tools
fight over the same Cloudflare object.

| Layer | Declared in | Owns |
| --- | --- | --- |
| Site | `wrangler.jsonc` | the Worker: `name`, `compatibility_date`, `assets.directory`, routes, bindings |
| Account | `infra/index.ts` | the zone and the custom domain bound to that Worker |

### The rule that keeps them apart

**Pulumi never declares the Worker script.** `wrangler deploy` publishes the bundle and the asset
manifest on every push. A `cloudflare.WorkersScript` in Pulumi would hold a snapshot of both from
whenever it was last applied, so the next `pulumi up` would roll the live site back to that stale
copy. The Worker belongs to wrangler; the hostname belongs to Pulumi.

**The custom domain creates its own DNS.** `WorkersCustomDomain` registers the proxied DNS record
and provisions the edge certificate. Adding a `cloudflare.DnsRecord` for the same hostname collides
with the record that resource already manages.

### Site

```bash
npm run build
npx wrangler deploy --dry-run   # validate the config and the asset list, upload nothing
npx wrangler deploy             # upload
```

`wrangler.jsonc` points at `./dist` with `not_found_handling: "404-page"`, so an unknown path gets
the real `dist/404.html` instead of an empty 200.

**Connect the repo (once, in the Cloudflare dashboard):** Workers & Pages → Create → Workers →
Import a Git repository. Build command `npm run build`, deploy command `npx wrangler deploy`, root
directory `/`. Every push to `main` deploys; every branch and PR gets a preview URL. Nothing about
the deploy lives only in that dashboard — `wrangler.jsonc` is the config, and Cloudflare holds its
own credentials, so there is no deploy secret to rotate.

### Account infrastructure

Run from this machine for now. State lives in Pulumi Cloud, not in the repo.

```bash
brew install pulumi/tap/pulumi
pulumi login                            # Pulumi Cloud; free for individuals
cd infra && npm install
pulumi stack init dev                   # creates Pulumi.dev.yaml — commit it
pulumi config set accountId <cloudflare-account-id>
pulumi config set zoneId <cloudflare-zone-id>
pulumi config set hostname sitezi.com
pulumi config set workerName sitezi     # must equal `name` in wrangler.jsonc
export CLOUDFLARE_API_TOKEN=...         # environment only, never a file
export CLOUDFLARE_ACCOUNT_ID=...
pulumi preview                          # read the diff before applying
pulumi up
```

`workerName` and `wrangler.jsonc`'s `name` are the same string in two files. Change both together or
the domain binds to a Worker that does not exist.

`Pulumi.dev.yaml` holds non-secret config and is committed. A value set with `pulumi config set
--secret` is encrypted with the stack's key before it is written, so that is safe to commit as
well. The account and zone IDs are identifiers, not credentials. The API token is the credential
and it never touches a file.

Scope the token to the one zone: `Zone:DNS:Edit`, `Zone:Zone:Read`, `Workers:Edit`. Nothing
account-wide.

### Until the domain exists

`infra/` is inert: no zone to bind, no hostname to serve, nothing to apply. `pulumi preview` fails
on the missing `zoneId` and `hostname`, which is the truth rather than a bug — the first real apply
is the day the domain is registered, and it is one resource.

The site's address meanwhile is its `*.workers.dev` subdomain. `site` in `astro.config.mjs` is
intentionally unset until there is a real URL: a placeholder there would emit wrong canonical URLs
and wrong sitemap entries, which is worse than the missing feature. Set `site` and add back
`@astrojs/sitemap` in the same commit, once the URL is known.

## Analytics

PostHog, in `src/components/PostHog.astro`, mounted once from `Base.astro`. The full reasoning lives
in that file's comments; the operational parts are here.

```bash
# .env — the same two names in every deploy environment, not just locally
PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

- **No token, no script.** The component renders nothing unless `PUBLIC_POSTHOG_PROJECT_TOKEN` is
  set. `npm run build` with the variable empty emits zero analytics markup — verified against the
  built output, not assumed. So local dev, `astro preview` and CI stay out of the data without
  anyone having to remember to opt out.
- **Inline, not bundled.** The script must stay inline: Astro hoists and bundles a plain `<script>`
  regardless of the condition around it, which would load PostHog even with no token configured.
  Inline is also why `define:vars` injects the values — an inline script is not processed by Vite,
  so `import.meta.env` would ship as a literal reference and throw at runtime.
- **No cookie, no banner.** `persistence: 'memory'` keeps everything in memory, so there is nothing
  to consent to. The trade is that each page load looks like a new visitor. If a consent banner ever
  exists, switch that one value to `'localStorage+cookie'` and nothing else changes.
- **Zero bytes on the critical path.** The built site contains no JavaScript bundle — HTML and CSS
  only, plus the inline loader. The loader is async, and PostHog's own `array.js` is fetched from
  their CDN afterwards.
- **To remove analytics entirely:** delete `src/components/PostHog.astro` and its single import line
  in `src/layouts/Base.astro`. Nothing else references it.

## Not yet — deliberately

Add these when there is a reason, not before:

| Thing | Add when |
| --- | --- |
| Custom domain | I buy one. One `WorkersCustomDomain` in Pulumi, one `site` value in `astro.config.mjs`. |
| Pulumi in CI | Infra changes start landing without me at a keyboard, or state needs to be readable from more than one machine. Until then local state in Pulumi Cloud is enough. |
| RSS feed | Anyone asks, or I syndicate. ~15 lines with `@astrojs/rss`. |
| Sitemap | There is a real URL to put in `site`. `@astrojs/sitemap` warns and skips without one, and a placeholder URL would emit wrong entries. Add both together. |
| Per-post capture events | Pageviews turn out not to be enough. Then a named event per real action — never before, since an event nobody queries is a maintenance cost with no reader. |
| `alt`/ARIA linting | The site gains images or interactive components. `eslint-plugin-astro`'s recommended set is 9 rules and contains no accessibility rules; adding them means another plugin, which is not worth it while there is nothing to check. |
| Tags / archive | The listing page gets long enough to be hard to scan. |
| Comments | Almost certainly never. If it happens: giscus (GitHub Discussions). No database. |
| Dark mode | The design wants it. `prefers-color-scheme` first, a toggle only if asked for. |
| Lighthouse CI gate | After the first deploy, so the accessibility thresholds have a real URL to run against. |

## Decisions log

Append here rather than re-litigating in chat. Newest first.

- **PostHog for analytics, memory-only.** Wanted pageviews and referrers without a consent banner or
  a third-party script on the critical path. `persistence: 'memory'` is what buys the no-banner part;
  the cost is per-page-load visitor identity, which a blog has no use for. The one sanctioned
  exception to the no-client-side-JS rule, isolated to a single component.
- **PostHog's loader is vendored, not installed.** `posthog-js` as a dependency would put tens of KB
  in our bundle and — worse — be hoisted by Astro, breaking the "no token, no script" guard. The
  inline snippet is PostHog's own documented Astro path. It is excluded from Prettier, because
  formatting it expands what ships for no benefit.
- **Prettier ignores markdown.** Its only change to hand-wrapped prose is padding table columns,
  which re-diffs every row of a table when one cell is edited.
- **ESLint is kept for 9 Astro rules, not for accessibility.** `astro check` already type-checks
  everything, so the linter's value here is the deprecated-API and valid-compile rules. It needs
  `typescript-eslint` purely to parse the TypeScript in `.astro` frontmatter. If it ever costs more
  than it catches, delete it and keep `check`.
- **Pulumi over Terraform.** The Cloudflare Terraform provider's resources, expressed as typed
  TypeScript in the repo's own language and toolchain. The trade is HCL's ubiquity for one less
  language here; nothing about the resources themselves changes.
- **Pulumi owns the edge, wrangler owns the Worker.** Two tools writing one Cloudflare resource is
  how a deploy gets reverted by an unrelated `up`. The boundary is written down in [Deploy](#deploy)
  so it does not have to be rediscovered.
- **Docs before code — and after it.** The stack, the infrastructure boundary and the accessibility
  rules were written before the code so it had something to conform to. Both files are living: change
  them in the same commit as the change they describe, including when the change is that a
  documented claim turned out to be wrong.
- **Cloudflare Workers, not Pages.** Cloudflare merged static hosting into Workers; Workers Static
  Assets is the recommended target for new projects and costs the same.
- **No adapter.** Pure static output means `@astrojs/cloudflare` is not needed. It is for SSR only,
  and adding it would mean a Worker script running on every request.
- **Tailwind v4 via the Vite plugin.** `@astrojs/tailwind` is deprecated and unsupported from
  Astro 6 on; `@tailwindcss/vite` in `vite.plugins` is the supported path.
- **Cloudflare's Git integration over GitHub Actions.** Moving `wrangler deploy` into Actions would
  mean storing a Cloudflare API token as a repo secret for no benefit, and `wrangler.jsonc` already
  holds every deploy setting that matters. Revisit if infra ever needs a pipeline of its own. *(If
  this ever changes, it is in `infra/`, not Pulumi, so the two decisions are independent.)*
