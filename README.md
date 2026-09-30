# sitezi

Personal website of **Pedro Frattezi Silva** — a landing page and a markdown blog.

Two URLs matter:

- `/` — who I am, what I do, how to reach me
- `/blog` — posts, written in markdown, committed as files

Everything here is boring on purpose: static HTML out, no runtime, no database, no CMS, no
client-side framework. A post is a `.md` file; publishing is a `git push`.

> **Status: documentation first.** This README and `AGENTS.md` are the project's basis and were
> written before the code. Nothing is deployed yet. Sections describing files that do not exist
> yet are the target, not a description of what is on disk — keep this in sync as they land.

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
- **S3 + CloudFront + Terraform.** I know how to do it. Hosting HTML does not need an ACM cert,
  an OAC, and a cache invalidation strategy.
- **A headless CMS.** The CMS is `git`. A markdown file in the repo is the draft, the review, the
  history and the publish step in one.

---

## Requirements

- **Node >= 22.12** (Astro 7's floor). Developed on Node 24.
- npm (lockfile committed; do not mix package managers).

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

## Project structure

```text
src/
  content.config.ts        # Zod schema for every collection — the content contract
  content/
    blog/                  # one markdown file per post; filename = URL slug
  layouts/
    Base.astro             # <html>, <head>, skip link, header/footer. Every page uses it.
  components/              # small presentational .astro components
  lib/
    posts.ts               # the ONE place posts are queried and drafts are filtered out
  styles/
    global.css             # Tailwind entry + @theme design tokens
  pages/
    index.astro            # /
    blog/
      index.astro          # /blog — post listing
      [...slug].astro      # /blog/<slug> — post page
public/                    # static files copied verbatim (favicon, robots.txt)
wrangler.jsonc             # Cloudflare Workers config: serves ./dist as static assets
```

Rule of thumb: `pages/` routes and fetches data, `layouts/` wraps, `components/` renders markup it
was handed. Anything that queries content lives in `lib/`.

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

The site builds to `dist/` and is served by Cloudflare Workers Static Assets. `wrangler.jsonc`
already points at `./dist` with `not_found_handling: "404-page"`, so a real `dist/404.html`
is returned for unknown paths instead of an empty 200.

Local check of the deploy config (no upload):

```bash
npm run build
npx wrangler deploy --dry-run
```

Manual deploy, when CI is not the answer:

```bash
npm run build && npx wrangler deploy
```

**Connect the repo (once, in the Cloudflare dashboard):** Workers & Pages → Create → Workers →
Import a Git repository. Build command `npm run build`, deploy command `npx wrangler deploy`, root
directory `/`. Every push to `main` deploys; every branch/PR gets a preview URL. Nothing to
configure in this repo, and no deploy secrets to rotate — Cloudflare holds its own credentials.

`site` in `astro.config.mjs` must be the real deployed URL, or the sitemap integration warns and
skips. Until a domain exists that is the `*.workers.dev` URL; when the domain lands, change `site`
in one place plus the `routes` block in `wrangler.jsonc`.

## Not yet — deliberately

Add these when there is a reason, not before:

| Thing | Add when |
| --- | --- |
| Custom domain | I buy one. One `site` value + one `wrangler.jsonc` route. |
| RSS feed | Anyone asks, or I syndicate. ~15 lines with `@astrojs/rss`. |
| Tags / archive | The listing page gets long enough to be hard to scan. |
| Analytics | I actually want to know something. Then a cookieless option — no third-party script blocking render. |
| Comments | Almost certainly never. If it happens: giscus (GitHub Discussions). No database. |
| Dark mode | The design wants it. `prefers-color-scheme` first, a toggle only if asked for. |
| Lighthouse CI gate | After the first deploy, so the a11y thresholds have a real URL to run against. |

## Decisions log

Append here rather than re-litigating in chat. Newest first.

- **Docs before code.** The stack and the HCI/accessibility rules are written down first so the
  code has something to conform to. Both files are living — change them in the same commit as the
  change they describe.
- **Cloudflare Workers, not Pages.** Cloudflare merged static hosting into Workers; Workers Static
  Assets is the recommended target for new projects and costs the same.
- **No adapter.** Pure static output means `@astrojs/cloudflare` is not needed. It is for SSR only,
  and adding it would mean a Worker script running on every request.
- **Tailwind v4 via the Vite plugin.** `@astrojs/tailwind` is deprecated and unsupported from
  Astro 6 on; `@tailwindcss/vite` in `vite.plugins` is the supported path.
- **Cloudflare's Git integration over GitHub Actions.** Moving `wrangler deploy` into Actions would
  mean storing a Cloudflare API token as a repo secret for no benefit.
