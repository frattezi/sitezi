---
title: Hello, world
description: Why this site is static, what builds it, and what I plan to write about.
pubDate: 2026-09-30
draft: false
---

The first post on a new site is usually a test that the deploy works. This one is partly that. It
is also the place to write down what this thing is, so the next decision has something to argue
with.

## Nearly no JavaScript

This site renders to HTML at build time and ships it. Astro compiles the pages, Tailwind compiles
the stylesheet, and the whole thing is a directory of files. There is no server rendering anything
when you load a page, and on most pages there is no JavaScript at all — the browser gets markup and
a stylesheet and that is the end of it.

That matters less because JavaScript is expensive to download and more because of what it forces.
A page with no script has nothing to fail, nothing to hydrate, and nothing to keep in sync with the
server. It is the same bytes in five years.

## What there is instead

- **Markdown files in the repository.** A post is a `.md` file with a little frontmatter. Its
  filename is its URL. Publishing is a commit.
- **A schema.** The frontmatter is validated at build time, so a post missing a date fails the
  build rather than shipping quietly broken.
- **A static host.** The built files go to Cloudflare's edge. There is no origin to keep alive.

## What I want to write about

Systems and infrastructure mostly — the parts of building software that are about constraint and
tradeoff rather than syntax. Terraform and Pulumi, observability that earns its cost, and the
recurring discovery that the boring solution was right.

Expect the occasional post about something I got wrong, because those are the ones worth reading.
