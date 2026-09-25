export type DocumentStatus = "active" | "scheduled" | "expired";

export type DocumentListItem = {
  id: string;
  slug: string;
  title: string;
  originalName: string;
  sizeBytes: number;
  downloadStart: string;
  downloadEnd: string;
  createdAt: string;
};

export type PublicDocument = Pick<
  DocumentListItem,
  "slug" | "title" | "originalName" | "sizeBytes" | "downloadStart" | "downloadEnd"
>;

export function getDocumentStatus(
  document: Pick<DocumentListItem, "downloadStart" | "downloadEnd">,
  now = Date.now(),
): DocumentStatus {
  const start = new Date(document.downloadStart).getTime();
  const end = new Date(document.downloadEnd).getTime();

  if (now < start) return "scheduled";
  if (now > end) return "expired";
  return "active";
}
