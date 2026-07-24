// Formats stored JSON-like payloads for compact audit views without mutating the original data.
export const prettyJson = (value: unknown): string => JSON.stringify(value, null, 2)

const NUMBER_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

// Parses strict JSON first, then a small paste-friendly object syntax for ledger forms.
export const parseLooseJson = (value: string, label: string): unknown => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return new LooseJsonParser(value, label).parse()
  }
}

// Parses ledger command payloads as JSON objects because DAML arguments are records.
export const parseJsonObject = (value: string, label: string): Record<string, unknown> => {
  const parsed = parseLooseJson(value, label)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`)
  }
  return parsed as Record<string, unknown>
}

// Canonicalizes pasted ledger JSON so the textarea shows the exact submitted payload.
export const formatJsonInput = (value: string, label: string): string =>
  prettyJson(parseJsonObject(value, label))

class LooseJsonParser {
  private index = 0

  // Keeps parser state local so invalid pasted ledger payloads never use eval.
  constructor(
    private readonly source: string,
    private readonly label: string,
  ) {}

  // Parses one full value and rejects trailing non-whitespace characters.
  parse(): unknown {
    this.skipWhitespace()
    const value = this.parseValue()
    this.skipWhitespace()
    if (this.index < this.source.length) {
      throw this.error(`unexpected token "${this.source[this.index]}"`)
    }
    return value
  }

  // Parses any supported JSON value or loose bare token.
  private parseValue(): unknown {
    this.skipWhitespace()
    const char = this.source[this.index]
    if (char === '{') {
      return this.parseObject()
    }
    if (char === '[') {
      return this.parseArray()
    }
    if (char === '"' || char === "'") {
      return this.parseQuotedString()
    }
    return this.parseBareValue()
  }

  // Parses object fields with optional commas so newline-separated records work.
  private parseObject(): Record<string, unknown> {
    this.index += 1
    const result: Record<string, unknown> = {}
    while (true) {
      this.skipSeparators()
      if (this.source[this.index] === '}') {
        this.index += 1
        return result
      }
      if (this.index >= this.source.length) {
        throw this.error('unterminated object')
      }
      const key = this.parseKey()
      this.skipWhitespace()
      if (this.source[this.index] !== ':') {
        throw this.error(`expected ":" after key "${key}"`)
      }
      this.index += 1
      result[key] = this.parseValue()
    }
  }

  // Parses array values with optional commas for pasted CID lists.
  private parseArray(): unknown[] {
    this.index += 1
    const result: unknown[] = []
    while (true) {
      this.skipSeparators()
      if (this.source[this.index] === ']') {
        this.index += 1
        return result
      }
      if (this.index >= this.source.length) {
        throw this.error('unterminated array')
      }
      result.push(this.parseValue())
    }
  }

  // Reads quoted or unquoted object keys up to the required colon.
  private parseKey(): string {
    this.skipWhitespace()
    const char = this.source[this.index]
    if (char === '"' || char === "'") {
      return this.parseQuotedString()
    }
    const start = this.index
    while (this.index < this.source.length && this.source[this.index] !== ':') {
      this.index += 1
    }
    const key = this.source.slice(start, this.index).trim()
    if (key === '') {
      throw this.error('empty object key')
    }
    return key
  }

  // Reads strings with common JSON escapes while also accepting single quotes.
  private parseQuotedString(): string {
    const quote = this.source[this.index]
    this.index += 1
    let result = ''
    while (this.index < this.source.length) {
      const char = this.source[this.index]
      this.index += 1
      if (char === quote) {
        return result
      }
      if (char === '\\') {
        result += this.parseEscape()
      } else {
        result += char
      }
    }
    throw this.error('unterminated string')
  }

  // Converts JSON-style escapes in quoted pasted strings.
  private parseEscape(): string {
    const char = this.source[this.index]
    this.index += 1
    if (char === 'n') {
      return '\n'
    }
    if (char === 'r') {
      return '\r'
    }
    if (char === 't') {
      return '\t'
    }
    if (char === 'b') {
      return '\b'
    }
    if (char === 'f') {
      return '\f'
    }
    if (char === 'u') {
      const hex = this.source.slice(this.index, this.index + 4)
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
        throw this.error('invalid unicode escape')
      }
      this.index += 4
      return String.fromCharCode(Number.parseInt(hex, 16))
    }
    return char ?? ''
  }

  // Reads unquoted values until a structural delimiter or line break.
  private parseBareValue(): unknown {
    const start = this.index
    while (this.index < this.source.length && !this.isBareValueDelimiter(this.source[this.index])) {
      this.index += 1
    }
    const token = this.source.slice(start, this.index).trim()
    if (token === '') {
      throw this.error('expected value')
    }
    if (token === 'true') {
      return true
    }
    if (token === 'false') {
      return false
    }
    if (token === 'null') {
      return null
    }
    return NUMBER_PATTERN.test(token) ? Number(token) : token
  }

  // Keeps bare strings from swallowing the next field on newline-separated input.
  private isBareValueDelimiter(char: string | undefined): boolean {
    return char === undefined || char === ',' || char === '}' || char === ']' || char === '\n'
  }

  // Skips ordinary whitespace between values without accepting commas at top level.
  private skipWhitespace(): void {
    while (this.index < this.source.length && /\s/.test(this.source[this.index] ?? '')) {
      this.index += 1
    }
  }

  // Skips commas and whitespace between fields/items to support quick pasted forms.
  private skipSeparators(): void {
    while (
      this.index < this.source.length &&
      (this.source[this.index] === ',' || /\s/.test(this.source[this.index] ?? ''))
    ) {
      this.index += 1
    }
  }

  // Adds field context to syntax errors shown in the ledger tools panel.
  private error(message: string): Error {
    return new Error(`${this.label}: ${message}`)
  }
}
