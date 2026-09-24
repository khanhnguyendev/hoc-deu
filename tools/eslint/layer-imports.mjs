// Layer import rules (platform design §7.2). Every import — `@/` alias, relative, re-export or
// dynamic import() — is resolved to a repo path first, so `../patterns/x` is judged exactly like
// `@/components/patterns/x`, and a feature may reach its own files but not another feature's.
import path from 'node:path'

const MESSAGES = {
  app: 'Nothing imports from app/ (layer 5).',
  features: 'Lower layers must not import features.',
  patterns: 'components/ui must not import patterns.',
  components: 'lib/ and tools/ are non-UI.',
  utilsI18n: 'This layer may only use lib/utils and lib/i18n from lib/.',
  featureInternals: 'Import other features through their index.ts only.',
  uiInPages: 'Pages compose features and patterns, not ui primitives.',
  componentsInApi: 'Route handlers are thin adapters: lib/* and feature index.ts, no components.',
  domain: 'lib/domain is pure: only lib/domain and zod.',
}

const under = (p, dir) => p === dir || p.startsWith(`${dir}/`)
const stripIndex = (p) =>
  p.replace(/\/index(?:\.[cm]?[jt]sx?)?$/, '').replace(/\.[cm]?[jt]sx?$/, '')

/** The repo path an import points at, or null for a package. */
function target(spec, file) {
  if (spec.startsWith('@/')) return stripIndex(path.posix.normalize(spec.slice(2)))
  if (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../')) {
    return stripIndex(path.posix.join(path.posix.dirname(file), spec))
  }
  return null
}

/** `features/<name>` for any path inside a feature, else null. */
const featureOf = (p) => (under(p, 'features') ? (p.split('/')[1] ?? null) : null)

/** Why `file` may not import `to`, or null when the import is allowed. */
export function violation(file, to) {
  const lib = under(to, 'lib') && !under(to, 'lib/utils') && !under(to, 'lib/i18n')

  if (under(file, 'lib/domain')) return under(to, 'lib/domain') ? null : MESSAGES.domain
  if (under(file, 'app')) {
    // The catalog renders every layer (§7.2 row `app/dev/components`).
    if (under(file, 'app/dev')) return null
    if (under(file, 'app/api')) {
      if (under(to, 'components')) return MESSAGES.componentsInApi
    } else if (under(to, 'components/ui')) return MESSAGES.uiInPages
  }
  if (!under(file, 'app') && under(to, 'app')) return MESSAGES.app

  const toFeature = featureOf(to)
  if (toFeature !== null) {
    const ownFeature = featureOf(file)
    if (under(file, 'components') || under(file, 'lib') || under(file, 'tools')) {
      return MESSAGES.features
    }
    const publicApi = to === `features/${toFeature}`
    if (toFeature !== ownFeature && toFeature !== 'items' && !publicApi) {
      return MESSAGES.featureInternals
    }
  }

  if (under(file, 'components/ui')) {
    if (under(to, 'components/patterns')) return MESSAGES.patterns
    if (lib) return MESSAGES.utilsI18n
  }
  if (under(file, 'components/patterns') && lib) return MESSAGES.utilsI18n
  if ((under(file, 'lib') || under(file, 'tools')) && under(to, 'components')) {
    return MESSAGES.components
  }
  return null
}

/** @type {import('eslint').Rule.RuleModule} */
const imports = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce the component layer rules on alias and relative imports.' },
    schema: [],
  },
  create(context) {
    const file = path.relative(context.cwd, context.filename).split(path.sep).join('/')
    const check = (source) => {
      if (source?.type !== 'Literal' || typeof source.value !== 'string') return
      const to = target(source.value, file)
      const message = to === null ? null : violation(file, to)
      if (message !== null)
        context.report({ node: source, message: `'${source.value}': ${message}` })
    }
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
    }
  },
}

const layers = { meta: { name: 'layers' }, rules: { imports } }

export default layers
