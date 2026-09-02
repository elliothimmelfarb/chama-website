// Email from the Hearth, through the same Resend resource the intake uses.
//
// Plain text only. Nothing a visitor typed is interpolated into a message
// except their own address in the To line. A send failure is logged by name
// and reported to the caller; nothing here retries.

import { Resend } from "resend";

export const FROM_NAME = "Chama Inteligente";
export const CONTACT = "contact@chamainteligente.com";

export function mailConfig(env = process.env) {
  const apiKey = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  const domain = typeof env.RESEND_EMAIL_DOMAIN === "string" ? env.RESEND_EMAIL_DOMAIN.trim() : "";
  return { apiKey, domain, configured: Boolean(apiKey && domain) };
}

export async function send({ to, subject, text, idempotencyKey, attachments }, dependencies = {}) {
  const config = dependencies.config || mailConfig();
  if (!config.configured) throw new Error("MailUnconfigured");
  const resend = dependencies.resend || new Resend(config.apiKey);
  const { error } = await resend.emails.send(
    {
      from: `${FROM_NAME} <hearth@${config.domain}>`,
      to: [to],
      subject,
      text,
      ...(Array.isArray(attachments) && attachments.length ? { attachments } : {})
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );
  if (error) {
    console.error("Hearth mail failed", error?.name || "ResendError");
    throw new Error("MailSendFailed");
  }
}

/* ---------- messages ---------- */

const signature = `\n\nElliot Himmelfarb\nChama Inteligente\nhttps://chamainteligente.com`;

export function magicLinkMessage({ link, isNew }) {
  return {
    subject: isNew ? "Your way into the Hearth" : "Sign in to the Hearth",
    text:
      (isNew
        ? "Welcome. This link creates your place in the Hearth, the members' room of Chama Inteligente, and signs you in:"
        : "Here is your sign-in link for the Hearth:") +
      `\n\n${link}\n\nIt works once and expires in 15 minutes. If you did not ask for it, ignore this message; nothing happens without the link.` +
      signature
  };
}

export function verifyMessage({ link }) {
  return {
    subject: "Confirm your email for the Hearth",
    text:
      `Confirm this is your address to finish setting up your account:\n\n${link}\n\nThe link expires in 24 hours. If you did not create an account, ignore this message.` +
      signature
  };
}

export function resetMessage({ link }) {
  return {
    subject: "Reset your Hearth password",
    text:
      `Set a new password with this link:\n\n${link}\n\nIt works once and expires in 30 minutes. If you did not ask for it, your password is unchanged and you can ignore this.` +
      signature
  };
}

export function inviteMessage({ link, roleLabel, fromName }) {
  return {
    subject: `${fromName} invited you to the Hearth`,
    text:
      `${fromName} has set up a place for you in the Hearth, the members' room of Chama Inteligente, as ${roleLabel}.\n\nAccept the invitation here:\n\n${link}\n\nThe link expires in 7 days.` +
      signature
  };
}
