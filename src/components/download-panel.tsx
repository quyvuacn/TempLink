"use client";

import { useEffect, useMemo, useState } from "react";
import { ClockIcon, DownloadIcon, FileIcon } from "@/components/icons";
import { getDocumentStatus, type PublicDocument } from "@/types/document";

type Props = { document: PublicDocument; demoMode: boolean };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function countdown(target: number, now: number) {
  const total = Math.max(0, target - now);
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function DownloadPanel({ document, demoMode }: Props) {
  const [now, setNow] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const status = now === null ? "scheduled" : getDocumentStatus(document, now);
  const statusCopy = useMemo(() => {
    if (now === null) return "Checking availability…";
    if (status === "scheduled" && document.downloadStart) {
      return `Available in ${countdown(new Date(document.downloadStart).getTime(), now)}.`;
    }
    if (status === "expired") return "This download has expired.";
    if (document.downloadEnd) {
      return `Available · ${countdown(new Date(document.downloadEnd).getTime(), now)} remaining.`;
    }
    return "Available now.";
  }, [document.downloadEnd, document.downloadStart, now, status]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (demoMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        setError("This is a preview. Connect Supabase to download the file.");
        return;
      }

      const response = await fetch(`/api/download/${encodeURIComponent(document.slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create a download link.");
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not download the document.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card download-card">
      <span className="document-chip"><FileIcon /> {document.originalName} · {formatBytes(document.sizeBytes)}</span>
      <h1>{document.title}</h1>

      {(document.downloadStart || document.downloadEnd) && (
        <div className="window-panel">
          {document.downloadStart && <div className="window-item"><span>Available from</span><strong>{formatDate(document.downloadStart)}</strong></div>}
          {document.downloadEnd && <div className="window-item"><span>Expires at</span><strong>{formatDate(document.downloadEnd)}</strong></div>}
        </div>
      )}

      <div className={`access-status ${status}`}>
        <ClockIcon />
        <span>{statusCopy}</span>
      </div>

      <form className="download-form" onSubmit={submit}>
        {document.passwordRequired && (
          <div className="field">
            <label htmlFor="download-password">Password</label>
            <input
              id="download-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete="off"
              disabled={now === null || status !== "active"}
              required
            />
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={now === null || status !== "active" || (document.passwordRequired && !password) || loading}>
          <DownloadIcon /> {loading ? "Checking…" : "Download"}
        </button>
      </form>
    </section>
  );
}
