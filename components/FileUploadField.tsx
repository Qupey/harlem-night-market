"use client";

import { useId, useState, type Dispatch, type SetStateAction } from "react";
import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES, MAX_FILES_PER_FIELD, UPLOAD_FIELDS, type UploadField } from "@/lib/schema";

type Files = Partial<Record<UploadField, File[]>>;

export function FileUploadField({
  field,
  files,
  setFiles,
}: {
  field: UploadField;
  files: Files;
  setFiles: Dispatch<SetStateAction<Files>>;
}) {
  const id = useId();
  const cfg = UPLOAD_FIELDS[field];
  const selected = files[field] ?? [];
  const [error, setError] = useState<string | null>(null);

  function onChange(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const bad = picked.find((f) => f.size > MAX_FILE_BYTES || !ALLOWED_FILE_TYPES.includes(f.type));
    if (bad) {
      setError(`${bad.name} must be a PDF or image under 10 MB.`);
      return;
    }
    const next = cfg.multiple ? [...selected, ...picked].slice(0, MAX_FILES_PER_FIELD) : picked.slice(0, 1);
    setError(cfg.multiple && selected.length + picked.length > MAX_FILES_PER_FIELD ? `Up to ${MAX_FILES_PER_FIELD} files.` : null);
    setFiles((prev) => ({ ...prev, [field]: next }));
  }

  function remove(index: number) {
    setFiles((prev) => ({ ...prev, [field]: selected.filter((_, i) => i !== index) }));
  }

  return (
    <div>
      <span className="field-label">{cfg.label}</span>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-line bg-field px-3 py-4 text-sm text-muted transition hover:border-teal"
      >
        {cfg.multiple ? "Choose files" : "Choose a file"}
        <span className="ml-1 text-muted/70">(PDF or image, 10 MB max)</span>
      </label>
      <input
        id={id}
        type="file"
        className="sr-only"
        accept={ALLOWED_FILE_TYPES.join(",")}
        multiple={cfg.multiple}
        onChange={(e) => {
          onChange(e.target.files);
          e.target.value = "";
        }}
      />
      {selected.length > 0 && (
        <ul className="mt-2 space-y-1">
          {selected.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-sm text-cream">
              <span className="truncate">{f.name}</span>
              <button type="button" onClick={() => remove(i)} className="shrink-0 text-muted underline hover:text-danger">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
