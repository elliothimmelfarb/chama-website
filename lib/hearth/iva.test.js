import assert from "node:assert/strict";
import test from "node:test";

import { ivaFor, cleanBilling } from "./iva.js";

const LLC = {
  kind: "business", legal_name: "Nelson Ventures LLC", address_line1: "1 Main St", city: "Austin",
  country: "US", tax_id: "12-3456789"
};

test("a US LLC with its proof pays no Portuguese IVA, and the invoice says why", () => {
  const iva = ivaFor(LLC);
  assert.equal(iva.ratePercent, 0);
  assert.equal(iva.ready, true);
  assert.match(iva.note, /autoliquidação/);
  assert.match(iva.note, /artigo 6\.º n\.º 6 alínea a\)/);
});

test("a business abroad without its tax ID cannot be invoiced without IVA yet", () => {
  const iva = ivaFor({ ...LLC, tax_id: "" });
  assert.equal(iva.ready, false);
  assert.deepEqual(iva.missing, ["tax ID"]);
});

test("an EU business is reverse charge, a Portuguese one and a private person pay 23 percent", () => {
  assert.equal(ivaFor({ ...LLC, country: "ES", tax_id: "ESB12345678" }).treatment, "eu-reverse-charge");
  assert.equal(ivaFor({ ...LLC, country: "PT" }).ratePercent, 23);
  assert.equal(ivaFor({ ...LLC, kind: "person" }).ratePercent, 23);
  assert.equal(ivaFor(null).ratePercent, 23);
});

test("billing details are cleaned: a made-up country or currency is dropped", () => {
  const clean = cleanBilling({ kind: "business", country: "usa", currency: "BTC", legalName: "  A   LLC " });
  assert.equal(clean.country, "");
  assert.equal(clean.currency, "EUR");
  assert.equal(clean.legal_name, "A LLC");
});
