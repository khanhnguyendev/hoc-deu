import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** TypeScript stays on 6.0.x and ESLint on 9.39.x (implementation plan, Global Constraints). */
describe('.github/dependabot.yml', () => {
  const config = readFileSync('.github/dependabot.yml', 'utf8')

  it.each(['typescript', 'eslint'])('ignores major and minor updates of %s', (name) => {
    const entry = config
      .slice(config.indexOf(`dependency-name: ${name}`))
      .split('- dependency-name')[0]
    expect(entry).toContain('version-update:semver-major')
    expect(entry).toContain('version-update:semver-minor')
  })
})
