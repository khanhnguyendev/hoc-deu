import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import betterTailwind from 'eslint-plugin-better-tailwindcss'

const PALETTE =
  '(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
const TOKEN_HINT = 'Use a semantic token utility (see docs/design/DESIGN_SYSTEM.md).'

// Layer rules (platform design §7.2). Each entry: files → import patterns they must not use.
const UP = (group, message) => ({ group, message })
const NO_APP = UP(['@/app', '@/app/*'], 'Nothing imports from app/ (layer 5).')
const NO_FEATURES = UP(['@/features', '@/features/*'], 'Lower layers must not import features.')
const NO_PATTERNS = UP(
  ['@/components/patterns', '@/components/patterns/*'],
  'components/ui must not import patterns.',
)
const NO_COMPONENTS = UP(['@/components', '@/components/*'], 'lib/ and tools/ are non-UI.')
const ONLY_UTILS_I18N = UP(
  ['@/lib/*', '!@/lib/utils', '!@/lib/i18n', '!@/lib/i18n/*'],
  'This layer may only use lib/utils and lib/i18n from lib/.',
)
const FEATURE_INTERNALS = UP(
  ['@/features/*/*', '!@/features/items/*'],
  'Import other features through their index.ts only.',
)
const NO_UI_IN_PAGES = UP(
  ['@/components/ui', '@/components/ui/*'],
  'Pages compose features and patterns, not ui primitives.',
)
const DOMAIN_ONLY = UP(
  [
    'react',
    'react-dom',
    'react/*',
    'next',
    'next/*',
    '@supabase/*',
    'date-fns',
    'date-fns/*',
    '@date-fns/*',
    '@/lib/*',
    '!@/lib/domain',
    '!@/lib/domain/*',
  ],
  'lib/domain is pure: only lib/domain and zod.',
)

const restrict = (...patterns) => ['error', { patterns }]

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
    'docs/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'better-tailwindcss': betterTailwind },
    settings: { 'better-tailwindcss': { entryPoint: 'app/globals.css' } },
    rules: {
      'better-tailwindcss/no-unknown-classes': 'error',
      'better-tailwindcss/no-conflicting-classes': 'error',
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [
            {
              pattern: '\\[[^\\]]*\\](?!:)',
              message: `Arbitrary values are not allowed. ${TOKEN_HINT}`,
            },
            {
              pattern: `^(?:.*:)?(bg|text|border|ring|fill|stroke|outline|decoration|from|via|to|shadow|divide|placeholder|caret|accent)-${PALETTE}-\\d{2,3}$`,
              message: `Raw palette colours are not allowed. ${TOKEN_HINT}`,
            },
            {
              pattern: '^(?:.*:)?(bg|text|border)-(black|white)$',
              message: `Raw black/white are not allowed. ${TOKEN_HINT}`,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['components/ui/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict(NO_APP, NO_FEATURES, NO_PATTERNS, ONLY_UTILS_I18N) },
  },
  {
    files: ['components/patterns/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict(NO_APP, NO_FEATURES, ONLY_UTILS_I18N) },
  },
  {
    files: ['features/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict(NO_APP, FEATURE_INTERNALS) },
  },
  {
    files: ['lib/**/*.{ts,tsx}', 'tools/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict(NO_APP, NO_FEATURES, NO_COMPONENTS) },
  },
  {
    files: ['lib/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(NO_APP, NO_FEATURES, NO_COMPONENTS, DOMAIN_ONLY),
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'lib/domain receives `now` as a parameter.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'lib/domain receives `now` as a parameter.',
        },
        { selector: "CallExpression[callee.name='fetch']", message: 'lib/domain does no I/O.' },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}'],
    ignores: ['app/api/**', 'app/dev/**'],
    rules: {
      'no-restricted-imports': restrict(NO_UI_IN_PAGES, FEATURE_INTERNALS),
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='className']",
          message: 'Pages contain no styling logic — compose patterns and features.',
        },
      ],
    },
  },
  {
    files: ['app/**/page.tsx', 'app/**/layout.tsx'],
    ignores: ['app/dev/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='className']",
          message: 'Pages contain no styling logic — compose patterns and features.',
        },
        {
          selector: "Program > ExpressionStatement[directive='use client']",
          message:
            "Pages and layouts are Server Components; put 'use client' in an interactive leaf component.",
        },
      ],
    },
  },
  {
    // The root layout sets the font variables on <html>; it is the only className allowed in app/.
    files: ['app/layout.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Program > ExpressionStatement[directive='use client']",
          message: 'The root layout is a Server Component.',
        },
      ],
    },
  },
])
