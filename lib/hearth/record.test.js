import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeRecord } from "./record.js";

const chapter = (extra) => sanitizeRecord({ chapters: [{ heading: "H", body: ["a", "b", "c"], ...extra }] }).chapters[0];

test("a chapter can place several figures between its paragraphs", () => {
  const c = chapter({ figures: [{ figure: "one", caption: "First", after: 1 }, { figure: "two", after: 9 }, { figure: "Bad Key" }] });
  assert.deepEqual(c.figures, [{ figure: "one", caption: "First", after: 1 }, { figure: "two", caption: "", after: 3 }]);
});

test("a chapter's single figure still goes after its paragraphs", () => {
  assert.deepEqual(chapter({ figure: "one", caption: "C" }).figures, [{ figure: "one", caption: "C", after: 3 }]);
});
