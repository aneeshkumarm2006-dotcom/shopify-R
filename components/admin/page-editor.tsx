"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Page, PageStatus } from "@/types";
import {
  Button,
  Card,
  Dropdown,
  Field,
  Icon,
  IconButton,
  Input,
  MenuItem,
  MenuSeparator,
  PageHeader,
  RichTextInput,
  Select,
  useToast,
  useConfirm,
  useUnsavedChanges,
  slugify,
} from "@/components/ui";
import { storeDomain } from "@/lib/format";
import { savePage, removePage } from "@/app/(admin)/pages/actions";

/**
 * Content-page editor (Online Store → Pages). Title · handle · rich-text body ·
 * visibility · SEO overrides. Wired to the savePage / removePage actions. Mirrors the
 * product/collection editors' save-bar + unsaved-changes guard so it feels consistent.
 */
export function PageEditor({
  page,
  storeSubdomain,
}: {
  page: Page | null;
  storeSubdomain?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const isNew = page === null;
  const [pending, startTransition] = useTransition();

  const [dirty, setDirty] = useState(isNew);
  const [title, setTitle] = useState(page?.title ?? "");
  const [handle, setHandle] = useState(page?.handle ?? "");
  const [handleEdited, setHandleEdited] = useState(!isNew);
  const [body, setBody] = useState(page?.body ?? "");
  const [status, setStatus] = useState<PageStatus>(page?.status ?? "visible");
  const [seoTitle, setSeoTitle] = useState(page?.seo?.title ?? "");
  const [seoDesc, setSeoDesc] = useState(page?.seo?.description ?? "");

  const mark = () => setDirty(true);
  useUnsavedChanges(dirty);

  function resetFields() {
    setTitle(page?.title ?? "");
    setHandle(page?.handle ?? "");
    setHandleEdited(!isNew);
    setBody(page?.body ?? "");
    setStatus(page?.status ?? "visible");
    setSeoTitle(page?.seo?.title ?? "");
    setSeoDesc(page?.seo?.description ?? "");
  }

  function onTitle(v: string) {
    setTitle(v);
    if (!handleEdited) setHandle(slugify(v));
    mark();
  }

  const previewBase = storeSubdomain ? `${storeDomain(storeSubdomain)}/pages/` : null;

  function save() {
    if (!title.trim()) {
      toast("Add a page title first", { tone: "critical" });
      return;
    }
    if (!handle.trim()) {
      toast("Add a handle first", { tone: "critical" });
      return;
    }
    startTransition(async () => {
      const res = await savePage(page?._id ?? null, {
        title: title.trim(),
        handle: handle.trim(),
        body,
        status,
        seo: { title: seoTitle.trim(), description: seoDesc.trim() },
      });
      if (!res.ok) {
        toast(res.error ?? "Couldn't save", { tone: "critical" });
        return;
      }
      setDirty(false);
      toast(isNew ? "Page created" : "Page saved");
      if (isNew && res.id) router.push(`/pages/edit/${res.id}`);
      else router.refresh();
    });
  }

  function discard() {
    setDirty(false);
    if (isNew) {
      router.push("/pages");
      return;
    }
    resetFields();
    router.refresh();
  }

  async function destroy(close: () => void) {
    if (!page) return;
    close();
    const ok = await confirm({
      title: "Delete page?",
      message: `“${page.title}” will be permanently deleted. This can’t be undone.`,
      confirmLabel: "Delete page",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await removePage(page._id);
      if (!res.ok) {
        toast("Couldn't delete the page", { tone: "critical" });
        return;
      }
      toast("Page deleted");
      router.push("/pages");
    });
  }

  return (
    <div style={{ paddingBottom: dirty ? 72 : 0 }}>
      <PageHeader
        breadcrumb={
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ padding: "0 6px", marginLeft: -6, color: "var(--text-muted)" }}
            onClick={() => router.push("/pages")}
          >
            <Icon name="chevronLeft" size={15} aria-hidden /> Pages
          </button>
        }
        title={isNew ? "New page" : title || "Untitled page"}
        actions={
          <>
            <Button variant="primary" disabled={!dirty} loading={pending} onClick={save}>
              {isNew ? "Create" : "Save"}
            </Button>
            {!isNew && (
              <Dropdown trigger={<IconButton name="dots" size={36} aria-label="More actions" />}>
                {(close) => (
                  <>
                    {status === "visible" && previewBase && (
                      <MenuItem
                        icon="external"
                        onClick={() => {
                          window.open(`https://${previewBase}${handle}`, "_blank", "noopener");
                          close();
                        }}
                      >
                        View on store
                      </MenuItem>
                    )}
                    <MenuSeparator />
                    <MenuItem icon="trash" danger onClick={() => destroy(close)}>
                      Delete page
                    </MenuItem>
                  </>
                )}
              </Dropdown>
            )}
          </>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: "var(--space-5)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "var(--space-5)" }}>
          <Card>
            <Field label="Title">
              {(p) => (
                <Input
                  {...p}
                  value={title}
                  onChange={(e) => onTitle(e.target.value)}
                  placeholder="About us"
                />
              )}
            </Field>
            <div style={{ marginTop: "var(--space-4)" }}>
              <Field label="Content">
                {(p) => (
                  <RichTextInput
                    {...p}
                    value={body}
                    onValueChange={(next) => {
                      setBody(next);
                      mark();
                    }}
                    rows={16}
                    placeholder="Write your page content…"
                  />
                )}
              </Field>
            </div>
          </Card>

          <Card title="Search engine listing">
            <Field label="Meta title" help="Defaults to the page title when empty.">
              {(p) => (
                <Input
                  {...p}
                  value={seoTitle}
                  onChange={(e) => {
                    setSeoTitle(e.target.value);
                    mark();
                  }}
                  placeholder={title || "Page title"}
                />
              )}
            </Field>
            <div style={{ marginTop: "var(--space-4)" }}>
              <Field label="Meta description">
                {(p) => (
                  <Input
                    {...p}
                    value={seoDesc}
                    onChange={(e) => {
                      setSeoDesc(e.target.value);
                      mark();
                    }}
                    placeholder="A short summary for search results."
                  />
                )}
              </Field>
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gap: "var(--space-5)" }}>
          <Card title="Visibility">
            <Field label="Status">
              {(p) => (
                <Select
                  {...p}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as PageStatus);
                    mark();
                  }}
                  options={[
                    { value: "visible", label: "Visible" },
                    { value: "hidden", label: "Hidden" },
                  ]}
                />
              )}
            </Field>
          </Card>

          <Card title="Web address">
            <Field label="Handle" help="The page's URL slug.">
              {(p) => (
                <Input
                  {...p}
                  mono
                  value={handle}
                  onChange={(e) => {
                    setHandle(slugify(e.target.value));
                    setHandleEdited(true);
                    mark();
                  }}
                  placeholder="about-us"
                />
              )}
            </Field>
            {previewBase && (
              <p
                className="mono"
                style={{ marginTop: 8, fontSize: "var(--text-xs)", color: "var(--text-muted)", wordBreak: "break-all" }}
              >
                {previewBase}
                {handle || "…"}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            marginTop: "var(--space-6)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-5)",
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              color: "var(--text-strong)",
            }}
          >
            {isNew ? "New page — not saved yet" : "Unsaved changes"}
          </span>
          <Button variant="ghost" onClick={discard} disabled={pending}>
            Discard
          </Button>
          <Button variant="primary" onClick={save} loading={pending}>
            {isNew ? "Create" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
