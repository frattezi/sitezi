# sitezi — agent instructions

Repo-level rules for this project. Where they conflict with `~/.agents/AGENTS.md`, **this file
wins**; where they are silent, the global file applies.

> **Status:** these rules were written before the code. The scaffold has not landed yet, so the
> commands below do not resolve until `package.json` exists. Read them as the target.

## What this is

A static personal website: a landing page and a markdown blog. Astro 7, Tailwind v4, content
collections, deployed to Cloudflare Workers Static Assets. Cloudflare account infrastructure — the
zone and the custom domain — is declared in Pulumi, in `infra/`.

There is no server, no database, no auth, no API, and no client-side framework. If a change seems
to need one of those, stop and ask — the answer is almost certainly a different change.

## Commands

| Command | Use |
| --- | --- |
| `npm run dev` | Dev server (port 4321) while working |
| `npm run build` | Static build to `./dist`. Run this before claiming a change works. |
| `npm run preview` | Serve the built output. Use this to verify, not `dev` — it is what ships. |
| `npm run check` | `astro check`: TypeScript + content schema. Must pass. |
| `npm run lint` | ESLint, including accessibility rules. Must pass. |
| `npm run format` | Prettier write (`prettier-plugin-astro`). |

`infra/` is a second, separate npm project. From inside it:

| Command | Use |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit`. Run after any change to `infra/index.ts`. |
| `npm run preview` | `pulumi preview` — show the diff. Read it. |
| `npm run up` | `pulumi up`. |

Run the scoped command for what you touched. Never claim success from `dev` alone — dev builds
posts on demand and does not catch the same errors as a production build.

## Hard rules

These are the mistakes that are easy to make and expensive to undo here.

1. **No client-side JS unless HTML or CSS cannot do it.** No React, Vue, Svelte, Solid, Alpine, or
   jQuery. No `client:*` directive without a written reason in the commit. A static site that
   ships a framework has thrown away the only reason it exists.
2. **No new dependency without asking.** This repo has a tiny dependency list on purpose. A
   date formatter, an icon, a slug helper — write the six lines, or use `Intl` and the stdlib. If a
   package is genuinely right, say what it saves and what it costs.
3. **No CMS, no database, no API routes.** Content is markdown in the repo. `output` stays
   `'static'`; do not add an adapter.
4. **No `any`, no `@ts-ignore`, no non-null assertion to silence a type error.** Fix the type.
   `astro/tsconfigs/strict` is in force.
5. **Do not restyle or rename things you were not asked about.** No drive-by refactors, no
   "while I was in there" cleanups, no reordering of files.
6. **Do not rewrite these docs into marketing prose.** They are operating instructions. Terse and
   concrete beats enthusiastic.
7. **Never commit `.env`, `dist/`, `.astro/`, or `node_modules/`.** `.gitignore` covers them; do
   not work around it.
8. **Never let Pulumi and wrangler declare the same Cloudflare resource.** The Worker and its assets
   belong to `wrangler.jsonc`; the hostname belongs to Pulumi. Violating this rolls the live site
   back on the next `pulumi up`. See [Infrastructure](#infrastructure).

## Where things live

```text
src/content.config.ts   the content contract — schema for every collection
src/content/blog/       markdown posts; filename is the slug
src/layouts/Base.astro  <html>, <head>, skip link, header/footer — every page uses it
src/components/         presentational .astro components
src/lib/                content queries and pure helpers
src/styles/global.css   Tailwind entry + @theme design tokens
src/pages/              routes only: fetch data, compose components, render
public/                 copied verbatim — favicon, robots.txt
wrangler.jsonc          Cloudflare Workers config: serves ./dist as static assets
infra/                  Pulumi program — the Cloudflare account layer, not the site
  index.ts              the custom domain bound to this site's Worker
  Pulumi.yaml           project definition
```

One source of truth per concern. If a value, query or style exists in two places, that is the bug.

## Patterns

### Astro and components

- Pages fetch, components render. A component receives data through `Props` and renders markup; it
  does not call `getCollection`.
- Declare props explicitly:

  ```astro
  ---
  interface Props {
    title: string;
    href: string;
  }
  const { title, href } = Astro.props;
  ---
  ```

- Reach for a component only when markup repeats or a page gets hard to read. One-off markup stays
  inline in the page.
- Pass content through `<slot />`, not a `content` prop, when it is markup.
- `getStaticPaths` returns every page to prerender. Drafts are filtered out before it runs, so a
  draft cannot be built.

### Content

- Every collection is declared in `src/content.config.ts` with a Zod schema. Unknown frontmatter
  keys and wrong types fail the build — that is the point. Never loosen a schema to make a post
  build; fix the post.
- The filename is the URL slug. Lowercase, hyphenated, no dates in the filename.
- Frontmatter body headings start at `##`; the layout renders the single `h1`.
- Drafts: `draft: true`. Publishing is flipping the flag in the same commit as the writing.
- **All post queries go through `src/lib/posts.ts`.** Draft filtering and sort order are defined
  once there. A page calling `getCollection` directly is a bug waiting to leak a draft.

### Styling

- Tailwind utilities in markup. No CSS modules, no styled-components, no per-component `<style>`
  block unless the rule is impossible in utilities (a keyframe, a complex selector).
- Design tokens live in `@theme` in `src/styles/global.css` (colors, fonts, spacing). Use the
  token, never a raw hex or a magic pixel value, when one exists.
- Post bodies are styled by the `prose` class from `@tailwindcss/typography`. Do not hand-style
  markdown elements.
- A repeated class string is a component; a repeated value is a token. Neither is a `@apply`.

### TypeScript

- Strict, `async/await`, no nested callbacks, descriptive names.
- Validate at boundaries: content frontmatter (Zod schema), `url`/`site` config, anything read from
  outside this repo. Trust internal code.
- Comments only where the reasoning is not obvious from the code.

## Infrastructure

The rule that keeps `pulumi up` from reverting a deploy, and the rest of what is easy to get wrong
here. Full walkthrough in [README → Deploy](README.md#deploy).

| Layer | Declared in | Owns |
| --- | --- | --- |
| Site | `wrangler.jsonc` | the Worker: `name`, `compatibility_date`, `assets.directory`, routes, bindings |
| Account | `infra/index.ts` | the zone and the custom domain bound to that Worker |

- **Never declare a Worker script in Pulumi.** `wrangler deploy` publishes the bundle and the asset
  manifest on every push. A `cloudflare.WorkersScript` here would hold a stale snapshot of both,
  and the next `up` would roll the live site back to it.
- **Never add a `cloudflare.DnsRecord` for a hostname bound by `WorkersCustomDomain`.** That
  resource creates the proxied record and provisions the edge certificate itself; a second
  declaration collides with it.
- `workerName` in `infra/` and `name` in `wrangler.jsonc` are the same string. Change both in the
  same commit.
- Credentials come from `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment.
  Never a file, never a stack-config value, never a commit.
- `Pulumi.<stack>.yaml` **is** committed — it holds the stack's non-secret config. A secret goes in
  with `pulumi config set --secret`, which encrypts it before writing.
- A key read with `config.require` that nothing sets fails at `preview`, not at compile. So
  `typecheck` passing does not mean the program runs: read the plan.
- **Read `pulumi preview` before `pulumi up`.** There is no CI for infra yet, so nothing will catch
  a destructive plan for you.
- `infra/` is inert until the zone and hostname are configured. That is expected, not broken.

## Accessibility — short, but not optional

Not a feature request; a property of a page anyone might read. Six rules:

- Semantic HTML, and exactly one `<h1>` per page. Headings nest; size comes from a class, never
  from the level.
- Everything reachable and operable by keyboard, with visible focus. Never a bare `outline: none`.
- `alt` on every image, `alt=""` when decorative.
- Contrast ≥ 4.5:1 for body text, 3:1 for large text and UI borders. Measure it, do not eyeball it.
- Any animation respects `prefers-reduced-motion`. No autoplay, no carousel, no parallax.
- Link text says where it goes. Never "click here", never a bare "read more".

**How this is enforced** — per the no-token-architecture rule, what a machine can check is checked
by a machine, not remembered by an agent:

| Gate | Catches |
| --- | --- |
| `npm run check` | Types, and frontmatter that does not match the schema |
| `npm run lint` | `eslint-plugin-astro` + a11y rules: missing alt, invalid ARIA, `<div onclick>`, heading order |
| `npm run build` | A broken post, a bad import, a route that will not prerender |
| `npm run preview` | The built output — what actually ships, unlike `dev` |
| Lighthouse CI (after the first deploy) | Rendered contrast, accessible names, SEO metadata, layout shift |

Lint covers roughly half of the rules above. The rest — contrast ratios, focus visibility, reading
measure — need the rendered page.

## Definition of done

A change is done when:

1. `npm run check` and `npm run lint` pass.
2. `npm run build` passes and `npm run preview` shows the change working.
3. For a change under `infra/`: `npm run typecheck` passes in `infra/`, and the `pulumi preview`
   diff is what you intended.
4. The rules above have been honoured, not just the lintable ones.
5. `README.md` and this file are updated **in the same commit** if the change affects the stack,
   the structure, the commands, or the patterns. They are living documents; a stale one is worse
   than none.
6. The commit message describes the change, not the process. No task IDs, no spec titles.
