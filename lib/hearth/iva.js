// Which IVA (Portuguese VAT) an invoice carries, from who is paying.
//
// Coaching and consulting are services, so CIVA artigo 6.º n.º 6 decides it:
// a business customer is taxed where it is established, a private person
// where Chama is. So a business outside Portugal pays no Portuguese IVA and
// the invoice says why (IVA - autoliquidação, as on fatura FT 1/1 to
// Campminder), and everyone else pays 23 percent on top of the price.
//
// No IVA is only allowed with proof the customer is a business: its legal
// name, address and tax ID (an EIN for a US LLC, a VIES-valid VAT number in
// the EU), declared by the member or recorded by the owner, with who did it
// and when. That is the "other proof" EU Implementing Regulation 282/2011
// artigo 18.º n.º 3 accepts for a customer outside the EU. A private person
// outside the EU is still an open question for the accountant, so they get
// the 23 percent until it is settled (see the brain's wiki/concepts/iva.md).

export const IVA_RATE = 23;

export const EU = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"
]);

export const CURRENCIES = ["EUR", "USD"];

const OUTSIDE_EU_NOTE = "IVA - autoliquidação. No Portuguese IVA: a service to a business established outside the EU, taxed where the customer is established (CIVA artigo 6.º n.º 6 alínea a)).";
const EU_NOTE = "IVA - autoliquidação. Reverse charge: VAT is due from the customer (CIVA artigo 6.º n.º 6 alínea a); Directive 2006/112/EC article 196).";

// What a tax ID is called where the business is.
export function taxIdName(country) {
  if (country === "PT") return "NIF";
  if (country === "US") return "EIN";
  if (EU.has(country)) return "VAT number";
  return "tax ID";
}

// What is missing before a business can be invoiced as one: abroad, that
// is what removes the IVA; in Portugal, the NIF is what lets the company
// deduct the IVA it pays.
export function missingForBusiness(profile) {
  const missing = [];
  if (!profile?.legal_name) missing.push("legal name");
  if (!profile?.address_line1 || !profile?.city) missing.push("address");
  if (!profile?.country) missing.push("country");
  if (!profile?.tax_id) missing.push(taxIdName(profile?.country));
  return missing;
}

// { treatment, ratePercent, note, ready, missing }. Ready is false only for
// a business without its details, which must not be invoiced until it has them.
export function ivaFor(profile) {
  if (profile?.kind === "business" && profile.country && profile.country !== "PT") {
    const missing = missingForBusiness(profile);
    const eu = EU.has(profile.country);
    return {
      treatment: eu ? "eu-reverse-charge" : "outside-eu-business",
      ratePercent: 0,
      note: eu ? EU_NOTE : OUTSIDE_EU_NOTE,
      ready: missing.length === 0,
      missing
    };
  }
  const missing = profile?.kind === "business" ? missingForBusiness(profile) : [];
  return { treatment: "portugal", ratePercent: IVA_RATE, note: "", ready: missing.length === 0, missing };
}

// The number as it is written on an invoice: a NIF as nine digits, an EIN
// as 12-3456789, an EU VAT number with its country prefix.
export function normalizeTaxId(country, raw) {
  const compact = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";
  if (country === "PT") return compact.replace(/^PT/, "");
  if (country === "US") return /^\d{9}$/.test(compact) ? compact.slice(0, 2) + "-" + compact.slice(2) : String(raw).trim();
  if (EU.has(country)) {
    const prefix = country === "GR" ? "EL" : country;
    return compact.startsWith(prefix) ? compact : prefix + compact;
  }
  return String(raw).replace(/\s+/g, " ").trim();
}

// A Portuguese NIF's last digit checks the other eight.
function validNif(nif) {
  if (!/^[1-9]\d{8}$/.test(nif)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i += 1) sum += Number(nif[i]) * (9 - i);
  const check = 11 - (sum % 11);
  return Number(nif[8]) === (check >= 10 ? 0 : check);
}

// Why a tax ID cannot be right, or "" when it can.
export function taxIdProblem(country, taxId) {
  if (!taxId) return "";
  if (country === "PT" && !validNif(taxId)) return "That NIF is not valid. It has nine digits, and the last one checks the others.";
  if (country === "US" && !/^\d{2}-\d{7}$/.test(taxId)) return "That EIN is not valid. It has nine digits, like 12-3456789.";
  return "";
}

// VIES gives an address as lines, the last with the postal code and city.
export function parseViesAddress(text) {
  const lines = String(text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { line1: "", line2: "", city: "", postalCode: "" };
  const last = lines[lines.length - 1];
  const m = last.match(/^(\d{4}-\d{3}|\d{4,5})\s+(.+)$/);
  const postalCode = m ? m[1] : "";
  const city = m ? m[2] : "";
  const middle = lines.slice(1, m ? -1 : undefined).filter((l) => l !== city);
  return { line1: lines[0], line2: middle.join(", "), city: city || (lines.length > 1 ? lines[lines.length - 1] : ""), postalCode };
}

// Stripe's tax ID types for the numbers members are likely to give.
export function stripeTaxIdType(country) {
  if (country === "US") return "us_ein";
  if (country === "GB") return "gb_vat";
  if (country === "CA") return "ca_bn";
  if (country === "AU") return "au_abn";
  if (country === "CH") return "ch_vat";
  if (country === "BR") return "br_cnpj";
  if (EU.has(country)) return "eu_vat";
  return null;
}

// The tax ID as Stripe wants it on the customer, or null when Stripe has no
// type for that country. A NIF is kept as nine digits, so it gets its PT back.
export function stripeTaxId(country, taxId) {
  const type = stripeTaxIdType(country);
  if (!type || !taxId) return null;
  if (type === "eu_vat") return { type, value: normalizeTaxId(country, taxId).replace(/^(\d)/, (d) => (country === "GR" ? "EL" : country) + d) };
  return { type, value: taxId };
}

// The billing details a person may send, cleaned. Kind is business or person.
export function cleanBilling(body = {}) {
  const text = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const kind = body.kind === "business" ? "business" : "person";
  const country = text(body.country, 3).toUpperCase();
  return {
    kind,
    legal_name: text(body.legalName, 200),
    address_line1: text(body.addressLine1, 200),
    address_line2: text(body.addressLine2, 200),
    city: text(body.city, 100),
    region: text(body.region, 100),
    postal_code: text(body.postalCode, 20),
    country: /^[A-Z]{2}$/.test(country) ? country : "",
    tax_id: normalizeTaxId(/^[A-Z]{2}$/.test(country) ? country : "", text(body.taxId, 40)),
    currency: CURRENCIES.includes(body.currency) ? body.currency : "EUR"
  };
}

export function billingView(row) {
  if (!row) return null;
  return {
    kind: row.kind,
    legalName: row.legal_name || "",
    addressLine1: row.address_line1 || "",
    addressLine2: row.address_line2 || "",
    city: row.city || "",
    region: row.region || "",
    postalCode: row.postal_code || "",
    country: row.country || "",
    taxId: row.tax_id || "",
    currency: row.currency || "EUR",
    evidence: row.evidence || "",
    declaredAt: row.declared_at || null,
    declaredBySelf: row.declared_by ? row.declared_by === row.user_id : null,
    sessionPriceCents: Number.isInteger(row.session_price_cents) ? row.session_price_cents : null,
    viesValidAt: row.vies_valid_at || null
  };
}
