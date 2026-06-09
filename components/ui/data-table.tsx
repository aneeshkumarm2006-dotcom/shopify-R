import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Data table / index list (DESIGN §3.4) — the admin workhorse behind Products,
 * Orders, Customers, Inventory. Sticky header, 52px rows, right-aligned mono
 * numeric columns, whole-row navigation, and an optional select-all + bulk-action
 * bar. Selection is controlled. Loading/empty are passed in (DESIGN §3.9).
 */
export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Right-align + mono/tabular for numbers (price, qty, totals). */
  numeric?: boolean;
  width?: number | string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Enables the leading checkbox column + bulk bar. */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Buttons shown in the bulk bar when ≥1 row is selected. */
  bulkActions?: ReactNode;
  /** Shown on the right of the bulk bar (e.g. pagination). */
  pagination?: ReactNode;
  /** Rendered in place of rows when `rows` is empty and not loading. */
  emptyState?: ReactNode;
  /** Rendered in place of rows while loading (e.g. <SkeletonRows/>). */
  loading?: ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectable,
  selectedIds = [],
  onSelectionChange,
  bulkActions,
  pagination,
  emptyState,
  loading,
}: DataTableProps<T>) {
  const selected = new Set(selectedIds);
  const allKeys = rows.map(rowKey);
  const allSelected = rows.length > 0 && allKeys.every((k) => selected.has(k));
  const someSelected = allKeys.some((k) => selected.has(k));
  const colSpan = columns.length + (selectable ? 1 : 0);

  function toggleAll() {
    onSelectionChange?.(allSelected ? [] : allKeys);
  }
  function toggleRow(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange?.([...next]);
  }

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {selectable && (
              <th className="col-check">
                <input
                  type="checkbox"
                  className="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.key}
                className={cx(c.numeric && "col-right")}
                style={c.width ? { width: c.width } : undefined}
                scope="col"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={colSpan} style={{ height: "auto", padding: 0 }}>
                {loading}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} style={{ height: "auto", padding: 0 }}>
                {emptyState}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              const isSelected = selected.has(key);
              return (
                <tr
                  key={key}
                  className={cx(onRowClick && "is-clickable", isSelected && "is-selected")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="checkbox"
                        aria-label={`Select row ${key}`}
                        checked={isSelected}
                        onChange={() => toggleRow(key)}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cx(c.numeric && "col-right num")}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {selectable && someSelected && (
        <div className="bulkbar">
          <span>
            <span className="count">{selected.size}</span> selected
          </span>
          {bulkActions}
          <span className="spacer" />
          {pagination}
        </div>
      )}
      {(!selectable || !someSelected) && pagination && (
        <div className="bulkbar">
          <span className="spacer" />
          {pagination}
        </div>
      )}
    </div>
  );
}
