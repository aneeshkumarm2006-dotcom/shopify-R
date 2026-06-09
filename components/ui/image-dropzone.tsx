"use client";

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { cx } from "./cx";

/**
 * Image dropzone (DESIGN §3.2). Drag-drop / click target, a thumbnail grid,
 * remove, and set-primary (first image is primary). Wired to Cloudinary signed
 * uploads in Stage 9 behind the same `images` / `onChange` shape: when Cloudinary
 * is configured each file is uploaded and its `secure_url` stored; otherwise it
 * falls back to a local object URL so the screen still works with no infra.
 */
export interface ImageDropzoneProps {
  /** Ordered image URLs; index 0 is the primary image. */
  images: string[];
  onChange: (next: string[]) => void;
  /** Label inside the empty drop target. */
  hint?: string;
}

export function ImageDropzone({
  images,
  onChange,
  hint = "Drag images here or click to upload",
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) return;

    setUploading((n) => n + picked.length);
    // Upload concurrently; fall back to a local object URL when Cloudinary is
    // unconfigured (null) or an upload fails, so the dropzone never blocks.
    const settled = await Promise.all(
      picked.map(async (f) => {
        try {
          return (await uploadToCloudinary(f)) ?? URL.createObjectURL(f);
        } catch {
          return URL.createObjectURL(f);
        }
      }),
    );
    setUploading((n) => Math.max(0, n - picked.length));
    onChange([...images, ...settled]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function remove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function setPrimary(index: number) {
    if (index === 0) return;
    const next = [...images];
    const [picked] = next.splice(index, 1);
    if (picked === undefined) return;
    next.unshift(picked);
    onChange(next);
  }

  return (
    <div>
      <div
        className={cx("dropzone", dragging && "is-drag")}
        role="button"
        tabIndex={0}
        aria-label={hint}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Icon name="upload" size={24} aria-hidden />
        <span style={{ fontSize: "var(--text-sm)" }}>{hint}</span>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          PNG, JPG or WEBP · up to 10MB each
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {(images.length > 0 || uploading > 0) && (
        <div className="dropzone-grid">
          {images.map((src, i) => (
            <div className="dropzone-tile" key={src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Upload ${i + 1}`} />
              {i === 0 ? (
                <span className="primary-tag">Primary</span>
              ) : (
                <button
                  type="button"
                  className="primary-tag"
                  style={{
                    background: "var(--surface)",
                    color: "var(--text)",
                    cursor: "pointer",
                    border: "1px solid var(--border)",
                  }}
                  onClick={() => setPrimary(i)}
                >
                  Set primary
                </button>
              )}
              <button
                type="button"
                className="remove"
                aria-label={`Remove image ${i + 1}`}
                onClick={() => remove(i)}
              >
                <Icon name="x" size={13} aria-hidden />
              </button>
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <div
              className="dropzone-tile"
              key={`uploading-${i}`}
              aria-label="Uploading image"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--surface-sunken)",
                color: "var(--text-muted)",
                minHeight: 88,
              }}
            >
              <span className="spinner" style={{ width: 20, height: 20 }} aria-hidden />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
