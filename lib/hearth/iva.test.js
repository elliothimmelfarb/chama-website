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
  assert.deepEqual(iva.missing, ["EIN"]);
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

import { normalizeTaxId, taxIdProblem, parseViesAddress } from "./iva.js";

test("a Portuguese business needs its NIF before it can be invoiced, and still pays 23 percent", () => {
  const firm = { kind: "business", legal_name: "Springvar, Lda", address_line1: "Rua A 1", city: "Lisboa", country: "PT", tax_id: "" };
  assert.deepEqual(ivaFor(firm).missing, ["NIF"]);
  assert.equal(ivaFor({ ...firm, tax_id: "519425235" }).ready, true);
  assert.equal(ivaFor({ ...firm, tax_id: "519425235" }).ratePercent, 23);
});

test("NIFs and EINs are tidied and checked: a typo in a NIF is caught by its check digit", () => {
  assert.equal(normalizeTaxId("PT", "PT 519 425 235"), "519425235");
  assert.equal(taxIdProblem("PT", "519425235"), "");
  assert.match(taxIdProblem("PT", "519425236"), /NIF/);
  assert.equal(normalizeTaxId("US", "123456789"), "12-3456789");
  assert.match(taxIdProblem("US", "12-34567"), /EIN/);
  assert.equal(normalizeTaxId("ES", "b-12345678"), "ESB12345678");
});

test("a VIES address splits into street, postal code and city", () => {
  assert.deepEqual(parseViesAddress("RUA CASCAIS 33 E 3 D\nLISBOA\n1300-120 LISBOA"), { line1: "RUA CASCAIS 33 E 3 D", line2: "", city: "LISBOA", postalCode: "1300-120" });
});

import { stripeTaxId } from "./iva.js";

test("a tax ID becomes the Stripe type and value Stripe validates", () => {
  assert.deepEqual(stripeTaxId("US", "12-3456789"), { type: "us_ein", value: "12-3456789" });
  // A NIF is stored as nine digits; Stripe's eu_vat wants the PT prefix.
  assert.deepEqual(stripeTaxId("PT", "509442013"), { type: "eu_vat", value: "PT509442013" });
  assert.equal(stripeTaxId("JP", "1234"), null);
});
