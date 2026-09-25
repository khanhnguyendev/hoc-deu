/**
 * Renders a `tests.yaml` value as a Java or Go source literal, and a `ValueType` as the matching
 * Java/Go type name (platform design §3.7). Used by 3.5b's generated Java and Go harnesses — pure
 * text rendering only, no execution.
 */
import type { ScalarType, ValueType } from '@/lib/content/schemas/tests'

const JAVA_BASE: Record<ScalarType, string> = {
  int: 'int',
  long: 'long',
  double: 'double',
  bool: 'boolean',
  string: 'String',
  char: 'char',
}

const GO_BASE: Record<ScalarType, string> = {
  int: 'int',
  long: 'int64',
  double: 'float64',
  bool: 'bool',
  string: 'string',
  char: 'byte',
}

/** The Java type for `type`, e.g. `{ base: 'int', dims: 2 }` → `'int[][]'`. */
export function javaType(type: ValueType): string {
  return `${JAVA_BASE[type.base]}${'[]'.repeat(type.dims)}`
}

/** The Go type for `type`, e.g. `{ base: 'int', dims: 2 }` → `'[][]int'`. */
export function goType(type: ValueType): string {
  return `${'[]'.repeat(type.dims)}${GO_BASE[type.base]}`
}

function escapeString(value: string): string {
  let out = ''
  for (const ch of value) {
    switch (ch) {
      case '\\':
        out += '\\\\'
        break
      case '"':
        out += '\\"'
        break
      case '\n':
        out += '\\n'
        break
      case '\r':
        out += '\\r'
        break
      case '\t':
        out += '\\t'
        break
      default:
        out += ch
    }
  }
  return `"${out}"`
}

function javaCharLiteral(value: string): string {
  if (value === '\\') return "'\\\\'"
  if (value === "'") return "'\\''"
  if (value === '\n') return "'\\n'"
  return `'${value}'`
}

function javaDoubleLiteral(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`
}

function javaScalarLiteral(value: unknown, base: ScalarType): string {
  switch (base) {
    case 'int':
      return `${value as number}`
    case 'long':
      return `${value as number}L`
    case 'double':
      return javaDoubleLiteral(value as number)
    case 'bool':
      return `${value as boolean}`
    case 'string':
      return escapeString(value as string)
    case 'char':
      return javaCharLiteral(value as string)
  }
}

function goScalarLiteral(value: unknown, base: ScalarType): string {
  switch (base) {
    case 'int':
      return `${value as number}`
    case 'long':
      return `int64(${value as number})`
    case 'double':
      return `float64(${value as number})`
    case 'bool':
      return `${value as boolean}`
    case 'string':
      return escapeString(value as string)
    case 'char':
      return `byte(${(value as string).charCodeAt(0)})`
  }
}

function arrayBody(
  value: unknown[],
  elementType: ValueType,
  scalarLiteral: (value: unknown, base: ScalarType) => string,
): string {
  if (elementType.dims > 0) {
    const inner: ValueType = { base: elementType.base, dims: (elementType.dims - 1) as 0 | 1 }
    const items = (value as unknown[][]).map((item) => arrayBody(item, inner, scalarLiteral))
    return `{${items.join(',')}}`
  }
  return `{${value.map((item) => scalarLiteral(item, elementType.base)).join(',')}}`
}

/** A Java source literal for `value` at `type`, e.g. `[[1, 2], [3]]` at `int[][]` →
 * `'new int[][]{{1,2},{3}}'`. */
export function javaLiteral(value: unknown, type: ValueType): string {
  if (type.dims === 0) return javaScalarLiteral(value, type.base)
  const inner: ValueType = { base: type.base, dims: (type.dims - 1) as 0 | 1 }
  return `new ${javaType(type)}${arrayBody(value as unknown[], inner, javaScalarLiteral)}`
}

/** A Go source literal for `value` at `type`, e.g. `[[1, 2], [3]]` at `int[][]` →
 * `'[][]int{{1,2},{3}}'`. */
export function goLiteral(value: unknown, type: ValueType): string {
  if (type.dims === 0) return goScalarLiteral(value, type.base)
  const inner: ValueType = { base: type.base, dims: (type.dims - 1) as 0 | 1 }
  return `${goType(type)}${arrayBody(value as unknown[], inner, goScalarLiteral)}`
}
