export type DocumentStatus = "active" | "scheduled" | "expired";

export type DocumentListItem = {
  id: string;
  slug: string;
  title: string;
  originalName: string;
  sizeBytes: number;
  downloadStart: string | null;
  downloadEnd: string | null;
  createdAt: string;
  accessPassword: string | null;
};

export type PublicDocument = Pick<
  DocumentListItem,
  "slug" | "title" | "originalName" | "sizeBytes" | "downloadStart" | "downloadEnd"
> & { passwordRequired: boolean };

export function getDocumentStatus(
  document: Pick<DocumentListItem, "downloadStart" | "downloadEnd">,
  now = Date.now(),
): DocumentStatus {
  const start = document.downloadStart ? new Date(document.downloadStart).getTime() : null;
  const end = document.downloadEnd ? new Date(document.downloadEnd).getTime() : null;

  if (start !== null && now < start) return "scheduled";
  if (end !== null && now > end) return "expired";
  return "active";
}
