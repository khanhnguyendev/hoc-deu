import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import betterTailwind from 'eslint-plugin-better-tailwindcss'
import layers from './tools/eslint/layer-imports.mjs'

const PALETTE =
  '(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
const COLOUR_UTILITY =
  '(bg|text|border(-[xytrblse])?|ring(-offset)?|inset-ring|outline|decoration|from|via|to|shadow|inset-shadow|drop-shadow|text-shadow|divide|placeholder|caret|accent|fill|stroke)'
const OPACITY = '(/\\S+)?'
const TOKEN_HINT = 'Use a semantic token utility (see docs/design/DESIGN_SYSTEM.md).'

// Style props may carry data as CSS custom properties (style={{ '--progress': value }}), nothing else.
const STYLE = "JSXAttribute[name.name='style'] > JSXExpressionContainer"
const STYLE_MESSAGE =
  "Style props may only set CSS custom properties, e.g. style={{ '--progress': value }}. Style with token utilities."
const STYLE_PROPS = [
  { selector: `${STYLE} > :not(ObjectExpression)`, message: STYLE_MESSAGE },
  { selector: `${STYLE} > ObjectExpression > SpreadElement`, message: STYLE_MESSAGE },
  {
    selector: `${STYLE} > ObjectExpression > Property:not([key.type='Literal'][key.value=/^--/])`,
    message: STYLE_MESSAGE,
  },
]
const NO_CLASSNAME_IN_PAGES = {
  selector: "JSXAttribute[name.name='className']",
  message: 'Pages contain no styling logic — compose patterns and features.',
}
const syntax = (...selectors) => ['error', ...STYLE_PROPS, ...selectors]

const DOMAIN_PACKAGES = {
  group: [
    'react',
    'react-dom',
    'react/*',
    'next',
    'next/*',
    '@supabase/*',
    'date-fns',
    'date-fns/*',
    '@date-fns/*',
  ],
  message: 'lib/domain is pure: only lib/domain and zod.',
}

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
              pattern: '(^|:)@?(min|max)-\\[',
              message:
                'Arbitrary breakpoints are not allowed. Use sm/md/lg/xl (DESIGN_SYSTEM.md §6).',
            },
            {
              pattern: `^(.*:)?!?${COLOUR_UTILITY}-${PALETTE}-\\d{2,3}${OPACITY}!?$`,
              message: `Raw palette colours are not allowed. ${TOKEN_HINT}`,
            },
            {
              pattern: `^(.*:)?!?${COLOUR_UTILITY}-(black|white)${OPACITY}!?$`,
              message: `Raw black/white are not allowed. ${TOKEN_HINT}`,
            },
            {
              pattern: '^(.*:)?(duration|delay)-\\d+$',
              message:
                'Use the motion tokens, e.g. duration-(--duration-fast) (DESIGN_SYSTEM.md §5).',
            },
            {
              pattern: '(^|:)!|!$',
              message: 'The important modifier is not allowed. Fix the cascade instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['{app,components,features,lib,tools}/**/*.{ts,tsx}'],
    plugins: { layers },
    rules: { 'layers/imports': 'error' },
  },
  {
    files: ['**/*.tsx'],
    rules: { 'no-restricted-syntax': syntax() },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/font/google',
              message:
                'Fonts are self-hosted (app/fonts, next/font/local): the build must work offline (platform design §2.1).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['lib/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [DOMAIN_PACKAGES] }],
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
    rules: { 'no-restricted-syntax': syntax(NO_CLASSNAME_IN_PAGES) },
  },
  {
    files: ['app/**/page.tsx', 'app/**/layout.tsx'],
    ignores: ['app/dev/**'],
    rules: {
      'no-restricted-syntax': syntax(NO_CLASSNAME_IN_PAGES, {
        selector: "Program > ExpressionStatement[directive='use client']",
        message:
          "Pages and layouts are Server Components; put 'use client' in an interactive leaf component.",
      }),
    },
  },
  {
    files: ['app/layout.tsx'],
    rules: {
      'no-restricted-syntax': syntax({
        selector: "Program > ExpressionStatement[directive='use client']",
        message: 'The root layout is a Server Component.',
      }),
    },
  },
])
