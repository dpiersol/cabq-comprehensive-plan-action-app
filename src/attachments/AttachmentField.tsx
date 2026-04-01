import { useId, useRef, useState } from "react";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_COUNT,
  attachmentAcceptAttribute,
  validateAttachmentFile,
} from "./attachmentPolicy";
import type { StoredAttachment } from "../draftStorage";

export interface AttachmentFieldProps {
  attachments: StoredAttachment[];
  onChange: (next: StoredAttachment[]) => void;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = r.result;
      if (typeof res !== "string") {
        reject(new Error("Unexpected read result"));
        return;
      }
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function newAttachmentId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AttachmentField({ attachments, onChange }: AttachmentFieldProps) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    const next = [...attachments];
    for (let i = 0; i < list.length; i++) {
      if (next.length >= MAX_ATTACHMENT_COUNT) {
        setError(`You can attach at most ${MAX_ATTACHMENT_COUNT} files.`);
        break;
      }
      const file = list.item(i);
      if (!file) continue;
      const v = validateAttachmentFile(file);
      if (!v.ok) {
        setError(v.reason ?? "File rejected.");
        continue;
      }
      setBusy(true);
      try {
        const dataBase64 = await readFileAsBase64(file);
        if (dataBase64.length * 0.75 > MAX_ATTACHMENT_BYTES * 1.5) {
          setError("Encoded file is too large.");
          continue;
        }
        next.push({
          id: newAttachmentId(),
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          dataBase64,
        });
      } catch {
        setError("Could not read file.");
      } finally {
        setBusy(false);
      }
    }
    onChange(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const remove = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
    setError(null);
  };

  return (
    <div className="field attachment-field">
      <span className="field-label" id={`${inputId}-legend`}>
        Attachments
      </span>
      <p className="hint">
        Documents and images only (e.g. PDF, Office, CSV, common image types). Max{" "}
        {MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB per file, up to {MAX_ATTACHMENT_COUNT} files.
        Executable, script, and database dump types are blocked. Files stay in this browser until you
        export; a future server should virus-scan and store them securely.
      </p>
      <input
        ref={fileRef}
        id={`${inputId}-file`}
        type="file"
        className="sr-only"
        multiple
        accept={attachmentAcceptAttribute()}
        aria-labelledby={`${inputId}-legend`}
        disabled={busy || attachments.length >= MAX_ATTACHMENT_COUNT}
        onChange={(e) => void addFiles(e.target.files)}
      />
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || attachments.length >= MAX_ATTACHMENT_COUNT}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "Adding…" : "Add files"}
        </button>
      </div>
      {error && (
        <p className="attachment-error" role="alert">
          {error}
        </p>
      )}
      {attachments.length > 0 && (
        <ul className="attachment-list">
          {attachments.map((a) => (
            <li key={a.id}>
              <span className="attachment-name" title={a.fileName}>
                {a.fileName}
              </span>
              <span className="muted small">
                ({(a.size / 1024).toFixed(1)} KB{a.mimeType ? ` · ${a.mimeType}` : ""})
              </span>
              <button type="button" className="link-button attachment-remove" onClick={() => remove(a.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
