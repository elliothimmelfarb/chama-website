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

// What is missing before a business can be invoiced without IVA.
export function missingForBusiness(profile) {
  const missing = [];
  if (!profile?.legal_name) missing.push("legal name");
  if (!profile?.address_line1 || !profile?.city) missing.push("address");
  if (!profile?.country) missing.push("country");
  if (!profile?.tax_id) missing.push(profile?.country && EU.has(profile.country) ? "VAT number" : "tax ID");
  return missing;
}

// { treatment, ratePercent, note, ready, missing }. Ready is false only for
// a business without its proof, which must not be invoiced until it has it.
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
  return { treatment: "portugal", ratePercent: IVA_RATE, note: "", ready: true, missing: [] };
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
    tax_id: text(body.taxId, 40),
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
    sessionPriceCents: Number.isInteger(row.session_price_cents) ? row.session_price_cents : null
  };
}
