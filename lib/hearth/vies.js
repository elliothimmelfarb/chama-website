// The EU's VIES register: is this VAT number live, and whose is it. For a
// Portuguese NIF it also gives the company's registered name and address, so
// a member types nine digits and the form fills in the rest. A valid answer
// is kept as proof that the business is one.

import { EU, parseViesAddress } from "./iva.js";

const URL_BASE = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number";

// { valid: true|false, name, address } or { valid: null } when VIES did not
// answer, which happens: it is down for one member state or another often.
export async function checkVat(country, taxId, { fetch: doFetch = globalThis.fetch, timeoutMs = 8000 } = {}) {
  if (!EU.has(country) || !taxId) return { valid: null };
  const prefix = country === "GR" ? "EL" : country;
  const vatNumber = taxId.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(new RegExp("^" + prefix), "");
  try {
    const response = await doFetch(URL_BASE, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ countryCode: prefix, vatNumber }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return { valid: null };
    const data = await response.json();
    if (typeof data?.valid !== "boolean") return { valid: null };
    const name = typeof data.name === "string" && data.name !== "---" ? data.name.trim() : "";
    const address = typeof data.address === "string" && data.address !== "---" ? parseViesAddress(data.address) : null;
    return { valid: data.valid, name, address };
  } catch {
    return { valid: null };
  }
}
