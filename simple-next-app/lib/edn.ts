// Minimal EDN reader/escaper for the ask.sock wire protocol.
//
// The channel speaks newline-delimited EDN (one `pr-str` map per line). We only
// need to *read* server replies and *escape* strings for the few request maps we
// build by hand, so this is a small recursive-descent reader — not a full EDN
// implementation. Keywords (and keyword map-keys) are returned as plain JS
// strings with the leading ':' stripped, which is all the app consumes.

class Reader {
  private i = 0;
  constructor(private readonly s: string) {}

  parse(): unknown {
    this.skipWs();
    const v = this.readValue();
    this.skipWs();
    return v;
  }

  private skipWs(): void {
    // EDN treats commas as whitespace.
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ',') this.i++;
      else break;
    }
  }

  private readValue(): unknown {
    this.skipWs();
    const c = this.s[this.i];
    if (c === undefined) throw new Error('EDN: unexpected end of input');
    if (c === '{') return this.readMap();
    if (c === '[') return this.readSeq(']');
    if (c === '(') return this.readSeq(')');
    if (c === '"') return this.readString();
    if (c === ':') { this.i++; return this.readToken(); } // keyword → bare name
    return this.readAtom();
  }

  private readMap(): Record<string, unknown> {
    this.i++; // consume '{'
    const obj: Record<string, unknown> = {};
    for (;;) {
      this.skipWs();
      if (this.s[this.i] === '}') { this.i++; break; }
      if (this.i >= this.s.length) throw new Error('EDN: unterminated map');
      const key = this.readValue();
      const val = this.readValue();
      obj[String(key)] = val;
    }
    return obj;
  }

  private readSeq(close: string): unknown[] {
    this.i++; // consume '[' or '('
    const arr: unknown[] = [];
    for (;;) {
      this.skipWs();
      if (this.s[this.i] === close) { this.i++; break; }
      if (this.i >= this.s.length) throw new Error('EDN: unterminated collection');
      arr.push(this.readValue());
    }
    return arr;
  }

  private readString(): string {
    this.i++; // consume opening quote
    let out = '';
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === '"') return out;
      if (c === '\\') {
        const e = this.s[this.i++];
        if (e === 'u') {
          out += String.fromCharCode(parseInt(this.s.slice(this.i, this.i + 4), 16));
          this.i += 4;
        } else {
          out += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r'
               : e === 'b' ? '\b' : e === 'f' ? '\f' : e; // \\ \" and others → literal
        }
      } else {
        out += c; // raw bytes (incl. ANSI ESC) pass through
      }
    }
    throw new Error('EDN: unterminated string');
  }

  private readAtom(): unknown {
    const tok = this.readToken();
    if (tok === 'true') return true;
    if (tok === 'false') return false;
    if (tok === 'nil') return null;
    if (/^[-+]?\d/.test(tok)) {
      const n = Number(tok.replace(/[NM]$/, '')); // drop bigint/bigdec markers
      if (!Number.isNaN(n)) return n;
    }
    return tok; // bare symbol → string
  }

  private readToken(): string {
    const start = this.i;
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ',' ||
          c === '{' || c === '}' || c === '[' || c === ']' ||
          c === '(' || c === ')' || c === '"') break;
      this.i++;
    }
    return this.s.slice(start, this.i);
  }
}

/** Parse one line of EDN into a JS value. Throws on malformed input. */
export function parseEdn(text: string): unknown {
  return new Reader(text).parse();
}

/** Escape a string for embedding inside an EDN string literal in a request. */
export function escapeEdnString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
