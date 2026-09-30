import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**', 'infra/bin/**', '.claude/**'],
  },

  ...astro.configs['flat/recommended'],

  {
    /*
     * `.astro` frontmatter is TypeScript, and the Astro parser hands it to the
     * default parser (espree) unless told otherwise — which fails on `interface
     * Props`. This is the only reason TypeScript parsing is wired up here.
     *
     * The scripts inside .astro files are deliberately not linted: the PostHog
     * loader is minified upstream and PostHog's `posthog` global is not declared
     * anywhere, so linting that block produces noise about code we do not own.
     * `no-undef` is off for that reason, not by accident.
     */
    files: ['**/*.astro'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
    rules: {
      'no-undef': 'off',
    },
  },
];
