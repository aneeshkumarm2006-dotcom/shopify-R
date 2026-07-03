import type { Product, ProductStatus } from "@/types";
import { minVariantPrice } from "./products";

/**
 * Product CSV import/export (Phase 4) — pure, so the serializer and the (fiddly,
 * quote-aware) parser are unit-tested without a DB. The format is a pragmatic
 * one-row-per-product shape over the product's primary variant: full multi-variant
 * round-tripping is intentionally out of scope for this MVP (documented on import).
 */

export const CSV_COLUMNS = [
  "handle",
  "title",
  "description",
  "status",
  "productType",
  "vendor",
  "tags", // pipe-separated, e.g. "sativa|premium"
  "price",
  "compareAtPrice",
  "sku",
  "barcode",
  "quantity",
] as const;

/** A parsed row, normalized to the fields the upsert needs. */
export interface ParsedProductRow {
  handle: string;
  title: string;
  description: string;
  status: ProductStatus;
  productType: string;
  vendor: string;
  tags: string[];
  price: number;
  compareAtPrice: number | null;
  sku: string;
  barcode: string;
  quantity: number;
}

/* --------------------------------------------------------------- export ---- */

function escapeField(value: string): string {
  let v = value;
  // CSV formula-injection defense (CWE-1236): a cell beginning with =, +, -, @, or a
  // control char is executed as a formula by Excel/Sheets. Prefix an apostrophe so the
  // spreadsheet treats it as literal text. Must run BEFORE the quote-wrapping below.
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  // Quote when the value contains a comma, quote, or newline; double interior quotes.
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function row(fields: (string | number)[]): string {
  return fields.map((f) => escapeField(String(f))).join(",");
}

/** Serialize products to a CSV string (header + one row per product). */
export function productsToCsv(products: Product[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const p of products) {
    const v = p.variants[0];
    lines.push(
      row([
        p.handle,
        p.title,
        // Strip HTML/newlines so the description stays a single tidy cell.
        (p.description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
        p.status,
        p.productType ?? "",
        p.vendor ?? "",
        (p.tags ?? []).join("|"),
        v ? v.price : minVariantPrice(p),
        v?.compareAtPrice ?? "",
        v?.sku ?? "",
        v?.barcode ?? "",
        v?.inventory?.quantity ?? 0,
      ]),
    );
  }
  return lines.join("\n");
}

/* --------------------------------------------------------------- import ---- */

/**
 * Parse CSV text into a grid of cells (RFC-4180-ish): handles quoted fields,
 * escaped `""` quotes, and commas/newlines inside quotes. Trailing blank lines are
 * dropped. Exported for tests.
 */
/** Hard caps so a huge upload can't exhaust memory (CWE-400). ~5MB / 50k rows. */
const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_CSV_ROWS = 50_000;

export function parseCsvGrid(text: string): string[][] {
  if (text.length > MAX_CSV_BYTES) {
    throw new Error(`CSV too large (max ${Math.floor(MAX_CSV_BYTES / 1024 / 1024)}MB).`);
  }
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      record.push(field);
      rows.push(record);
      if (rows.length > MAX_CSV_ROWS) throw new Error(`CSV has too many rows (max ${MAX_CSV_ROWS}).`);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // Flush the final field/record if the file didn't end with a newline.
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    rows.push(record);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function asStatus(value: string): ProductStatus {
  return value.trim().toLowerCase() === "active" ? "active" : "draft";
}

function asNumber(value: string): number {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : 0;
}

export interface CsvParseResult {
  rows: ParsedProductRow[];
  errors: string[]; // human-readable, line-numbered
}

/**
 * Parse a product-import CSV. Maps columns by header name (case-insensitive), so
 * column order is flexible as long as `handle`, `title`, and `price` are present.
 * Bad rows are collected into `errors` (line-numbered) rather than aborting the batch.
 */
export function parseProductCsv(text: string): CsvParseResult {
  const grid = parseCsvGrid(text);
  if (grid.length === 0) return { rows: [], errors: ["The file is empty."] };

  const header = grid[0]!.map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const idx = {
    handle: col("handle"),
    title: col("title"),
    description: col("description"),
    status: col("status"),
    productType: col("producttype"),
    vendor: col("vendor"),
    tags: col("tags"),
    price: col("price"),
    compareAtPrice: col("compareatprice"),
    sku: col("sku"),
    barcode: col("barcode"),
    quantity: col("quantity"),
  };

  const errors: string[] = [];
  for (const required of ["handle", "title", "price"] as const) {
    if (idx[required] === -1) errors.push(`Missing required column "${required}".`);
  }
  if (errors.length) return { rows: [], errors };

  const at = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
  const rows: ParsedProductRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]!;
    const line = r + 1; // 1-based, accounting for the header
    const handle = at(cells, idx.handle).toLowerCase();
    const title = at(cells, idx.title);
    if (!handle || !title) {
      errors.push(`Line ${line}: handle and title are required — row skipped.`);
      continue;
    }
    const tags = at(cells, idx.tags)
      .split(/[|,]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const compareRaw = at(cells, idx.compareAtPrice);
    rows.push({
      handle,
      title,
      description: at(cells, idx.description),
      status: asStatus(at(cells, idx.status)),
      productType: at(cells, idx.productType),
      vendor: at(cells, idx.vendor),
      tags,
      price: asNumber(at(cells, idx.price)),
      compareAtPrice: compareRaw ? asNumber(compareRaw) : null,
      sku: at(cells, idx.sku),
      barcode: at(cells, idx.barcode),
      quantity: idx.quantity >= 0 ? asNumber(at(cells, idx.quantity)) : 0,
    });
  }

  return { rows, errors };
}
