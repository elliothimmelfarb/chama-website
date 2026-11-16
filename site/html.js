// Every page is a function that returns HTML through this tag. Interpolated
// values are escaped unless they are already Html (another html`` result or
// raw()), so copy can never inject markup. Arrays are joined, falsy values
// (false, null, undefined) render as nothing.

export class Html {
  constructor(text) {
    this.text = text;
  }
  toString() {
    return this.text;
  }
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

const render = (value) => {
  if (value === false || value === null || value === undefined) return "";
  if (value instanceof Html) return value.text;
  if (Array.isArray(value)) return value.map(render).join("");
  return escape(value);
};

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new Html(out);
}

// Trusted markup that must not be escaped: inline SVG from site/figures,
// JSON-LD already serialised, a stylesheet. Never pass copy through it.
export const raw = (text) => new Html(String(text));

// Copy may carry *emphasis* (rendered as <em>) and [a link](/path). Nothing
// else is markup; everything is escaped first.
export function inline(text) {
  const safe = escape(text)
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((\/[^)\s]*|#[^)\s]*)\)/g, '<a href="$2">$1</a>');
  return new Html(safe);
}
