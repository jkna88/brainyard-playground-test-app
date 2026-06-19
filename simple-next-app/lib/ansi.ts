// Strip ANSI escape sequences (CSI/OSC/colour codes) from terminal output.
// The ask.sock :display stream carries the TUI's raw rendered chunks, which
// include colour codes we don't want in HTML.
// Canonical ansi-regex pattern (chalk/ansi-regex), matches CSI + OSC sequences.
const ANSI_PATTERN = new RegExp(
  [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  ].join('|'),
  'g',
);

export function stripAnsi(s: string): string {
  return s.replace(ANSI_PATTERN, '');
}
