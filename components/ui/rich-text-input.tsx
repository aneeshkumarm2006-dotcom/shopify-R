"use client";

import { useRef, type TextareaHTMLAttributes } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cx } from "./cx";

/**
 * Minimal rich-text input (DESIGN §3.2). Toolbar is deliberately limited to
 * B / I / link / H2 / H3 / UL / OL — matching the PRD product-description scope
 * (no full WYSIWYG). This is the design-layer affordance; the toolbar wraps the
 * current selection with lightweight markdown-ish markers in the underlying
 * textarea so the control is real and keyboard-operable without a heavy editor.
 */
type Tool = {
  key: string;
  label: string;
  icon?: IconName;
  text?: string;
  wrap?: [string, string];
  linePrefix?: string;
  ariaLabel: string;
};

const TOOLS: (Tool | "sep")[] = [
  { key: "b", label: "B", wrap: ["**", "**"], ariaLabel: "Bold" },
  { key: "i", label: "I", icon: "italic", wrap: ["_", "_"], ariaLabel: "Italic" },
  { key: "link", label: "", icon: "link", wrap: ["[", "](https://)"], ariaLabel: "Link" },
  "sep",
  { key: "h2", label: "H2", linePrefix: "## ", ariaLabel: "Heading 2" },
  { key: "h3", label: "H3", linePrefix: "### ", ariaLabel: "Heading 3" },
  "sep",
  { key: "ul", label: "", icon: "list", linePrefix: "- ", ariaLabel: "Bulleted list" },
  { key: "ol", label: "", icon: "list", linePrefix: "1. ", ariaLabel: "Numbered list" },
];

export interface RichTextInputProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onValueChange?: (next: string) => void;
}

export function RichTextInput({
  value,
  onValueChange,
  className,
  ...rest
}: RichTextInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(tool: Tool) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    let next = value;
    let caret = end;

    if (tool.wrap) {
      const [a, b] = tool.wrap;
      next = value.slice(0, start) + a + selected + b + value.slice(end);
      caret = end + a.length + b.length;
    } else if (tool.linePrefix) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      next = value.slice(0, lineStart) + tool.linePrefix + value.slice(lineStart);
      caret = end + tool.linePrefix.length;
    } else if (tool.text) {
      next = value.slice(0, start) + tool.text + value.slice(end);
      caret = start + tool.text.length;
    }

    onValueChange?.(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="richtext">
      <div className="richtext-toolbar" role="toolbar" aria-label="Text formatting">
        {TOOLS.map((t, i) =>
          t === "sep" ? (
            <span key={`sep-${i}`} className="sep" aria-hidden="true" />
          ) : (
            <button
              key={t.key}
              type="button"
              className="richtext-tool"
              onClick={() => apply(t)}
              aria-label={t.ariaLabel}
              title={t.ariaLabel}
              style={t.key === "i" ? { fontStyle: "italic" } : undefined}
            >
              {t.icon ? <Icon name={t.icon} size={15} aria-hidden /> : t.label}
            </button>
          ),
        )}
      </div>
      <textarea
        ref={ref}
        className={cx("richtext-area", className)}
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        {...rest}
      />
    </div>
  );
}
