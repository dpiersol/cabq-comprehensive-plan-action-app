/** Opens default mail client with a summary (no attachments — browser limitation). */
export function openLegislationMailto(opts: {
  cpRecordId: string;
  title: string;
  /** Optional To: line (e.g. staff distribution list). */
  to?: string;
}): void {
  const title = opts.title.trim() || "(Untitled)";
  const subject = `${opts.cpRecordId}: ${title}`;
  const body = [
    `Comprehensive Plan Action record ${opts.cpRecordId}`,
    "",
    `Legislation title: ${title}`,
    "",
    "—",
    "Sent from CABQ Comprehensive Plan Action application",
  ].join("\n");
  const q = new URLSearchParams({ subject, body });
  globalThis.window.location.href = `mailto:${opts.to ?? ""}?${q.toString()}`;
}
