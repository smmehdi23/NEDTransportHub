// Polyfill WHATWG URL.parse() for Node.js < 22.1 (e.g. Node 20.16.0)
if (typeof URL.parse !== 'function') {
  URL.parse = function parse(input, base) {
    try {
      return base !== undefined ? new URL(input, base) : new URL(input);
    } catch {
      return null;
    }
  };
}
