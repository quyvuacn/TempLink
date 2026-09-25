"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import {
  CloseIcon,
  CopyIcon,
  EditIcon,
  FileIcon,
  LinkIcon,
  QrIcon,
  ShieldIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import {
  getDocumentStatus,
  type DocumentListItem,
  type DocumentStatus,
} from "@/types/document";

type Props = {
  initialDocuments: DocumentListItem[];
  demoMode: boolean;
  siteUrl: string;
};

type Toast = { message: string; type?: "error" } | null;

declare global {
  interface Document {
    modelContext?: {
      registerTool?: (
        tool: {
          name: string;
          title?: string;
          description: string;
          inputSchema: object;
          annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
          execute: (input: unknown) => unknown | Promise<unknown>;
        },
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(status: DocumentStatus) {
  if (status === "active") return "Active";
  if (status === "scheduled") return "Scheduled";
  return "Expired";
}

function extension(filename: string) {
  return filename.split(".").pop()?.slice(0, 4).toUpperCase() || "FILE";
}

export function AdminDashboard({ initialDocuments, demoMode, siteUrl }: Props) {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(toLocalInput(new Date(now.getTime() + 5 * 60_000)));
  const [end, setEnd] = useState(toLocalInput(new Date(now.getTime() + 2 * 60 * 60_000)));
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState(initialDocuments);
  const [selected, setSelected] = useState<DocumentListItem | null>(null);
  const [editing, setEditing] = useState<DocumentListItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedUrl = selected ? `${siteUrl}/d/${selected.slug}` : "";

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    void Promise.resolve(
      context.registerTool(
        {
          name: "stage_document_details",
          title: "Fill in document details",
          description:
            "Fill in the title, availability window, and password. The user must still choose a file and confirm the upload.",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              start: { type: "string", description: "ISO 8601 datetime" },
              end: { type: "string", description: "ISO 8601 datetime" },
              password: { type: "string", minLength: 6 },
            },
            required: ["title", "start", "end", "password"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const value = input as Record<string, unknown>;
            if (
              typeof value.title !== "string" ||
              typeof value.start !== "string" ||
              typeof value.end !== "string" ||
              typeof value.password !== "string" ||
              value.password.length < 6
            ) {
              throw new Error("Invalid document details.");
            }
            setTitle(value.title);
            setStart(toLocalInput(new Date(value.start)));
            setEnd(toLocalInput(new Date(value.end)));
            setPassword(value.password);
            return { staged: true, needsFile: true };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);

    return () => lifecycle.abort();
  }, []);

  const canSubmit = useMemo(
    () => Boolean(file && title.trim() && password.length >= 6 && start && end),
    [file, title, password, start, end],
  );

  function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    if (nextFile.size > 100 * 1024 * 1024) {
      setToast({ message: "File exceeds the 100 MB limit.", type: "error" });
      return;
    }
    setFile(nextFile);
    if (!title) setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
  }

  function generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const values = crypto.getRandomValues(new Uint32Array(8));
    setPassword(Array.from(values, (value) => alphabet[value % alphabet.length]).join(""));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !canSubmit) return;

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate <= startDate) {
      setToast({ message: "The expiration time must be after the start time.", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      if (demoMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        const item: DocumentListItem = {
          id: crypto.randomUUID(),
          slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "tai-lieu"}-${crypto.randomUUID().slice(0, 6)}`,
          title: title.trim(),
          originalName: file.name,
          sizeBytes: file.size,
          downloadStart: startDate.toISOString(),
          downloadEnd: endDate.toISOString(),
          createdAt: new Date().toISOString(),
        };
        setDocuments((current) => [item, ...current]);
        setSelected(item);
      } else {
        const initResponse = await fetch("/api/admin/uploads/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileSize: file.size,
          }),
        });
        const init = await initResponse.json();
        if (!initResponse.ok) throw new Error(init.error || "Could not start the upload.");

        const { error: uploadError } = await getSupabaseBrowser()
          .storage.from("documents")
          .uploadToSignedUrl(init.path, init.token, file, {
            contentType: file.type || "application/octet-stream",
          });
        if (uploadError) throw uploadError;

        const createResponse = await fetch("/api/admin/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath: init.path,
            title: title.trim(),
            originalName: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            downloadStart: startDate.toISOString(),
            downloadEnd: endDate.toISOString(),
            password,
          }),
        });
        const result = await createResponse.json();
        if (!createResponse.ok) throw new Error(result.error || "Could not save the document.");
        setDocuments((current) => [result.document, ...current]);
        setSelected(result.document);
      }

      setFile(null);
      setTitle("");
      setPassword("");
      setToast({ message: "Download link and QR code created." });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Something went wrong.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setToast({ message: "Link copied." });
  }

  function openEditor(document: DocumentListItem) {
    setEditing(document);
    setEditTitle(document.title);
    setEditStart(toLocalInput(new Date(document.downloadStart)));
    setEditEnd(toLocalInput(new Date(document.downloadEnd)));
    setEditPassword("");
    setEditFile(null);
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const startDate = new Date(editStart);
    const endDate = new Date(editEnd);
    if (!editTitle.trim() || endDate <= startDate) {
      setToast({ message: "Check the document name and availability window.", type: "error" });
      return;
    }
    if (editPassword && editPassword.length < 6) {
      setToast({ message: "The new password must contain at least 6 characters.", type: "error" });
      return;
    }
    if (editFile && editFile.size > 100 * 1024 * 1024) {
      setToast({ message: "File exceeds the 100 MB limit.", type: "error" });
      return;
    }

    setSavingEdit(true);
    try {
      let replacement: Record<string, unknown> = {};

      if (editFile && !demoMode) {
        const initResponse = await fetch("/api/admin/uploads/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: editFile.name,
            fileType: editFile.type || "application/octet-stream",
            fileSize: editFile.size,
          }),
        });
        const init = await initResponse.json();
        if (!initResponse.ok) throw new Error(init.error || "Could not start the upload.");

        const { error: uploadError } = await getSupabaseBrowser()
          .storage.from("documents")
          .uploadToSignedUrl(init.path, init.token, editFile, {
            contentType: editFile.type || "application/octet-stream",
          });
        if (uploadError) throw uploadError;

        replacement = {
          storagePath: init.path,
          originalName: editFile.name,
          mimeType: editFile.type || "application/octet-stream",
          sizeBytes: editFile.size,
        };
      }

      let updated: DocumentListItem;
      if (demoMode) {
        updated = {
          ...editing,
          title: editTitle.trim(),
          originalName: editFile?.name ?? editing.originalName,
          sizeBytes: editFile?.size ?? editing.sizeBytes,
          downloadStart: startDate.toISOString(),
          downloadEnd: endDate.toISOString(),
        };
      } else {
        const response = await fetch(`/api/admin/documents/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim(),
            downloadStart: startDate.toISOString(),
            downloadEnd: endDate.toISOString(),
            password: editPassword,
            ...replacement,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not update the document.");
        updated = result.document;
      }

      setDocuments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditing(null);
      setToast({ message: "Document updated." });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Could not update the document.",
        type: "error",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteDocument(document: DocumentListItem) {
    const confirmed = window.confirm(
      `Delete “${document.title}”? The file and download link will be permanently removed.`,
    );
    if (!confirmed) return;

    setDeletingId(document.id);
    try {
      if (!demoMode) {
        const response = await fetch(`/api/admin/documents/${document.id}`, {
          method: "DELETE",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not delete the document.");
      }
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setToast({ message: "Document deleted." });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Could not delete the document.",
        type: "error",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <header className="shell topbar">
        <a className="brand" href="/admin" aria-label="TempLink admin">
          <span className="brand-mark"><ShieldIcon /></span>
          TempLink
        </a>
      </header>

      <main className="shell">
        <section className="page-heading">
          <h1>Create download link</h1>
        </section>

        {demoMode && (
          <div className="demo-banner" role="status">
            <ShieldIcon width="18" height="18" />
            Preview mode — no data will be saved.
          </div>
        )}

        <div className="workspace-grid">
          <form className="card form-card" onSubmit={submit}>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            <div
              className={`dropzone${dragging ? " dragging" : ""}${file ? " has-file" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                chooseFile(event.dataTransfer.files[0]);
              }}
            >
              {file ? (
                <div>
                  <span className="file-icon"><FileIcon /></span>
                  <strong>{file.name}</strong>
                  <span>{formatBytes(file.size)} · Choose another file</span>
                </div>
              ) : (
                <div>
                  <span className="upload-icon"><UploadIcon /></span>
                  <strong>Choose file</strong>
                  <span>or drag and drop · 100 MB max</span>
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="field full">
                <label htmlFor="title">Document name</label>
                <input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Workshop materials"
                  maxLength={120}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="start">Available from</label>
                <input
                  id="start"
                  type="datetime-local"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="end">Expires at</label>
                <input
                  id="end"
                  type="datetime-local"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  min={start}
                  required
                />
              </div>
              <div className="field full">
                <label htmlFor="password">Password</label>
                <div className="password-wrap">
                  <input
                    id="password"
                    type="text"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 6 characters"
                    minLength={6}
                    maxLength={64}
                    autoComplete="off"
                    required
                  />
                  <button className="text-action" type="button" onClick={generatePassword}>
                    Generate
                  </button>
                </div>
              </div>
            </div>

            <div className="form-footer">
              <button className="primary-button" type="submit" disabled={!canSubmit || submitting}>
                {submitting ? "Creating…" : "Create link"}
              </button>
            </div>
          </form>
        </div>

        <section className="documents-section">
          <div className="section-heading">
            <div><h2>Documents</h2></div>
          </div>
          <div className="document-list">
            {documents.length === 0 ? (
              <div className="empty-state">No documents yet.</div>
            ) : (
              documents.map((document) => {
                const status = getDocumentStatus(document);
                const url = `${siteUrl}/d/${document.slug}`;
                return (
                  <article className="document-row" key={document.id}>
                    <div className="document-main">
                      <span className="document-type">{extension(document.originalName)}</span>
                      <div className="document-name">
                        <strong>{document.title}</strong>
                        <span>{document.originalName} · {formatBytes(document.sizeBytes)}</span>
                        <span className={`status-badge ${status}`}>{statusLabel(status)}</span>
                      </div>
                    </div>
                    <div className="document-time">
                      <strong>{formatDate(document.downloadStart)}</strong>
                      <span>to {formatDate(document.downloadEnd)}</span>
                    </div>
                    <div className="row-actions">
                      <button className="icon-button" type="button" title="Copy link" onClick={() => copy(url)}>
                        <CopyIcon />
                      </button>
                      <button className="icon-button" type="button" title="View QR code" onClick={() => setSelected(document)}>
                        <QrIcon />
                      </button>
                      <button className="icon-button" type="button" title="Edit" onClick={() => openEditor(document)}>
                        <EditIcon />
                      </button>
                      <button
                        className="icon-button danger-icon"
                        type="button"
                        title="Delete"
                        disabled={deletingId === document.id}
                        onClick={() => deleteDocument(document)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="qr-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button modal-close" type="button" aria-label="Close" onClick={() => setSelected(null)}><CloseIcon /></button>
            <h3 id="qr-title">Download QR code</h3>
            <p>{selected.title}</p>
            <div className="qr-frame"><QRCode value={selectedUrl} size={192} fgColor="#132238" /></div>
            <div className="share-link"><LinkIcon width="17" /><code>{selectedUrl}</code><button type="button" onClick={() => copy(selectedUrl)}>Copy</button></div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !savingEdit && setEditing(null)}>
          <div
            className="modal edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              type="button"
              aria-label="Close"
              disabled={savingEdit}
              onClick={() => setEditing(null)}
            >
              <CloseIcon />
            </button>
            <h3 id="edit-title">Edit document</h3>
            <form className="edit-form" onSubmit={saveEdit}>
              <div className="field">
                <label htmlFor="edit-name">Document name</label>
                <input
                  id="edit-name"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  maxLength={120}
                  required
                />
              </div>
              <div className="form-grid edit-time-grid">
                <div className="field">
                  <label htmlFor="edit-start">Available from</label>
                  <input
                    id="edit-start"
                    type="datetime-local"
                    value={editStart}
                    onChange={(event) => setEditStart(event.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-end">Expires at</label>
                  <input
                    id="edit-end"
                    type="datetime-local"
                    value={editEnd}
                    min={editStart}
                    onChange={(event) => setEditEnd(event.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="edit-password">New password</label>
                <input
                  id="edit-password"
                  type="text"
                  value={editPassword}
                  onChange={(event) => setEditPassword(event.target.value)}
                  placeholder="Leave blank to keep the current password"
                  minLength={6}
                  maxLength={64}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="edit-file">Replace file</label>
                <input
                  id="edit-file"
                  className="file-input"
                  type="file"
                  onChange={(event) => setEditFile(event.target.files?.[0] ?? null)}
                />
                <span className="helper">
                  {editFile
                    ? `${editFile.name} · ${formatBytes(editFile.size)}`
                    : `${editing.originalName} · ${formatBytes(editing.sizeBytes)}`}
                </span>
              </div>
              <div className="modal-actions">
                <button className="secondary-button" type="button" disabled={savingEdit} onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={savingEdit || !editTitle.trim()}>
                  {savingEdit ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className={`toast${toast.type === "error" ? " error" : ""}`} role="status">{toast.message}</div>}
    </>
  );
}
