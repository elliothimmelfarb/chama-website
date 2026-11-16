import assert from "node:assert/strict";
import test from "node:test";

import { html, raw, inline } from "../site/html.js";

test("copy interpolated into html`` is escaped, so it can never inject markup", () => {
  const name = '<script>alert("x")</script> & co';
  assert.equal(String(html`<p>${name}</p>`), "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co</p>");
});

test("nested html``, raw() and arrays render as markup; false, null and undefined render as nothing", () => {
  const items = ["a", "b"].map((x) => html`<li>${x}</li>`);
  assert.equal(String(html`<ul>${items}${false}${null}${undefined}${raw("<hr>")}</ul>`), "<ul><li>a</li><li>b</li><hr></ul>");
});

test("inline() turns *emphasis* and [links](/path) into markup and escapes everything else", () => {
  assert.equal(String(inline("Fits *your* process. [See how](/work) <b>")), 'Fits <em>your</em> process. <a href="/work">See how</a> &lt;b&gt;');
});

test("inline() only links to paths on this site, never to another origin or a script", () => {
  assert.equal(String(inline("[x](https://evil.example) [y](javascript:alert(1))")), "[x](https://evil.example) [y](javascript:alert(1))");
});
