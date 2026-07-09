/**
 * Stage 3 — Redaction agent.
 * Regex-strips PII from subjects and bodies BEFORE any LLM call:
 * emails, US phone numbers, order numbers, street addresses, and names
 * after greeting/sign-off patterns. Returns counts per category.
 */
import type { NormalizedTicket, RedactionCounts } from "../types";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// US phone formats: (555) 123-4567, 555-123-4567, +1 555.123.4567, 5551234567 with separators.
const PHONE_RE =
  /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]?\d{4}\b/g;

// Order numbers: #?[A-Z]{1,4}-?\d{4,} plus the bare "#12345" form.
const ORDER_RE = /#\d{4,}\b|#?\b[A-Z]{1,4}-?\d{4,}\b/g;

// Street addresses: number + up to three words + a street suffix, optional unit.
const ADDRESS_RE =
  /\b\d{1,6}\s+(?:[A-Za-z'.]+\s+){0,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Ter|Circle|Cir|Parkway|Pkwy|Highway|Hwy)\b\.?(?:,?\s*(?:Apt|Apartment|Suite|Ste|Unit|#)\s*[\w-]+)?/gi;

// Names following greeting / sign-off words: "Dear Maria," "Thanks, Sam Lee".
const NAME_RE =
  /\b(Dear|Hi|Hello|Hey|Thanks|Thank you|Best|Regards|Kind regards|Warm regards|Sincerely|Cheers)([,!]?\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;

export interface RedactResult {
  tickets: NormalizedTicket[];
  counts: RedactionCounts;
}

export function redactTickets(tickets: NormalizedTicket[]): RedactResult {
  const counts: RedactionCounts = {
    emails: 0,
    phones: 0,
    orderNumbers: 0,
    addresses: 0,
    names: 0,
    total: 0,
  };

  const scrub = (text: string): string => {
    if (!text) return text;
    let out = text;
    out = out.replace(EMAIL_RE, () => {
      counts.emails += 1;
      return "[redacted-email]";
    });
    out = out.replace(PHONE_RE, () => {
      counts.phones += 1;
      return "[redacted-phone]";
    });
    out = out.replace(ORDER_RE, () => {
      counts.orderNumbers += 1;
      return "[redacted-order]";
    });
    out = out.replace(ADDRESS_RE, () => {
      counts.addresses += 1;
      return "[redacted-address]";
    });
    out = out.replace(NAME_RE, (_match, greeting: string, separator: string) => {
      counts.names += 1;
      return `${greeting}${separator}[redacted-name]`;
    });
    return out;
  };

  const redacted = tickets.map((ticket) => ({
    ...ticket,
    subject: scrub(ticket.subject),
    body: scrub(ticket.body),
  }));

  counts.total =
    counts.emails + counts.phones + counts.orderNumbers + counts.addresses + counts.names;

  return { tickets: redacted, counts };
}
