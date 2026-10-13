// The shape of a session record written by hand (version 2).
//
// Version 1 is what the model writes from a transcript: a summary and
// lists. Version 2 adds what a crafted record needs: the short version,
// a picture for the big picture, the ideas as chapters with their own
// pictures and the client's words, this week's actions with steps and
// prompts, and what the next session is for. Every v1 field stays valid,
// so the page renders either.
//
// Whatever arrives is clipped to this shape; anything else is dropped.

import { sanitizeDerived } from "./derive.js";

export const FIGURE_KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;

function str(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function strings(value, maxItems, maxLen) {
  return Array.isArray(value) ? value.map((v) => str(v, maxLen)).filter(Boolean).slice(0, maxItems) : [];
}

function figureKey(value) {
  const key = str(value, 40);
  return FIGURE_KEY.test(key) ? key : "";
}

function quote(value) {
  if (!value || typeof value !== "object") return null;
  const text = str(value.text, 600);
  return text ? { text, who: str(value.who, 80) } : null;
}

export function sanitizeRecord(input) {
  const d = input && typeof input === "object" ? input : {};
  const base = sanitizeDerived(d);
  const hero = d.hero && typeof d.hero === "object" && figureKey(d.hero.figure)
    ? { figure: figureKey(d.hero.figure), caption: str(d.hero.caption, 300) }
    : null;
  const chapters = (Array.isArray(d.chapters) ? d.chapters : []).slice(0, 10).map((c) => {
    const chapter = { heading: str(c?.heading, 160), body: strings(c?.body, 8, 2000) };
    const figure = figureKey(c?.figure);
    if (figure) { chapter.figure = figure; chapter.caption = str(c.caption, 300); }
    const q = quote(c?.quote);
    if (q) chapter.quote = q;
    return chapter;
  }).filter((c) => c.heading);
  const actions = (Array.isArray(d.actions) ? d.actions : []).slice(0, 6).map((a) => {
    const action = { title: str(a?.title, 200), why: str(a?.why, 1200), steps: strings(a?.steps, 10, 400) };
    const prompt = str(a?.prompt, 6000);
    if (prompt) action.prompt = prompt;
    return action;
  }).filter((a) => a.title);
  const next = d.next && typeof d.next === "object"
    ? { when: str(d.next.when, 120), plan: strings(d.next.plan, 8, 400) }
    : null;
  return {
    ...base,
    version: 2,
    short: strings(d.short, 5, 400),
    hero,
    chapters,
    actions,
    next: next && (next.when || next.plan.length) ? next : null
  };
}
