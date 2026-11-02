import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeRecord } from "./record.js";

const chapter = (extra) => sanitizeRecord({ chapters: [{ heading: "H", body: ["a", "b", "c"], ...extra }] }).chapters[0];

test("a chapter can place several figures between its paragraphs", () => {
  const c = chapter({ figures: [{ figure: "one", caption: "First", after: 1 }, { figure: "two", after: 9 }, { figure: "Bad Key" }] });
  assert.deepEqual(c.figures, [{ figure: "one", caption: "First", after: 1 }, { figure: "two", caption: "", after: 3 }]);
});

test("a chapter keeps its last figure in the old field for a browser still on the old script", () => {
  const c = chapter({ figures: [{ figure: "one", after: 1 }, { figure: "two", caption: "Second", after: 2 }] });
  assert.equal(c.figure, "two");
  assert.equal(c.caption, "Second");
});

test("a chapter's single figure still goes after its paragraphs", () => {
  assert.deepEqual(chapter({ figure: "one", caption: "C" }).figures, [{ figure: "one", caption: "C", after: 3 }]);
});
