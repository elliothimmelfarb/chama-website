// One fake database for every Hearth test.
//
// The real client is Neon's: a tagged template (`sql`select ... ${value}``)
// that also answers `query(text, params)` and `transaction([...])`. This fake
// wears the same shape, normalizes each call to { text, values }, and hands
// it to the first handler whose pattern matches the text. Anything unmatched
// returns no rows, so a test only describes the queries it cares about.
//
// Every call is kept in `calls`, which is how a test asserts what was written
// without a database anywhere near it.

// handlers: an array of [pattern, rows | ({ text, values }) => rows] pairs.
export function fakeDb(handlers = []) {
  const list = handlers.map(([pattern, result]) => ({ pattern, result }));
  const calls = [];

  function run(text, values) {
    const call = { text, values };
    calls.push(call);
    const handler = list.find((entry) => entry.pattern.test(text));
    if (!handler) return Promise.resolve([]);
    const rows = typeof handler.result === "function" ? handler.result(call) : handler.result;
    return Promise.resolve(rows === undefined ? [] : rows);
  }

  // The tagged-template call shape: sql`...${a}...${b}` becomes a text with
  // $1, $2 placeholders and the values in order.
  const client = function tagged(strings, ...values) {
    if (!Array.isArray(strings)) throw new Error("FakeDbExpectedTaggedTemplate");
    const text = strings.reduce((out, part, i) => out + part + (i < values.length ? `$${i + 1}` : ""), "");
    return run(text, values);
  };

  client.query = (text, params = []) => run(String(text), params);
  client.transaction = async (queries) => await Promise.all(queries);
  client.calls = calls;
  client.matching = (pattern) => calls.filter((call) => pattern.test(call.text));
  client.count = (pattern) => client.matching(pattern).length;
  return client;
}

// A plain Request with the headers the Hearth reads, ready for a handler.
export function makeRequest(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("x-forwarded-host")) headers.set("x-forwarded-host", new URL(url).host);
  return new Request(url, { ...options, headers });
}
