"use client";

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { api } from "~/trpc/react";

type GridColumn = {
  id: string;
  name: string;
  type: string;
  width: number;
  isPrimary: boolean;
};

type FilterOperator =
  | "contains"
  | "notContains"
  | "equals"
  | "isEmpty"
  | "isNotEmpty"
  | "gt"
  | "lt";

type FilterCondition = {
  columnId: string;
  operator: FilterOperator;
  value?: string | number | null;
};

type Filters = {
  conjunction: "and" | "or";
  conditions: FilterCondition[];
};

type Sort = {
  columnId: string;
  direction: "asc" | "desc";
};

type RowData = {
  id: string;
  order: number;
  cells: Record<string, unknown>;
};

type RowHeight = "short" | "medium" | "tall" | "extra_tall";

const rowHeightPx: Record<RowHeight, number> = {
  short: 32,
  medium: 56,
  tall: 88,
  extra_tall: 120,
};

type FocusedCell = { rowIndex: number; columnId: string };
type EditingCell = { rowId: string; rowIndex: number; columnId: string };

type MoveDirection = "left" | "right" | "down" | "up" | null;

type GridContextValue = {
  focused: FocusedCell | null;
  setFocused: React.Dispatch<React.SetStateAction<FocusedCell | null>>;
  editing: EditingCell | null;
  setEditing: React.Dispatch<React.SetStateAction<EditingCell | null>>;
  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  startEdit: (rowIndex: number, columnId: string) => void;
  commitEdit: (move: MoveDirection) => void;
  expandRecord: (rowId: string) => void;
  columns: GridColumn[];
};

const GridContext = React.createContext<GridContextValue | null>(null);

function useGridContext() {
  const ctx = useContext(GridContext);
  if (!ctx) throw new Error("AirtableGrid: missing GridContext");
  return ctx;
}

// Column Menu Item Component
function ColumnMenuItem({
  label,
  icon,
  destructive,
  onClick,
}: {
  label: string;
  icon: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  const iconMap: Record<string, React.ReactNode> = {
    edit: <path d="M12.1 3.9l-8.1 8.1v3h3l8.1-8.1-3-3zm1.4-1.4l3 3-1.4 1.4-3-3 1.4-1.4z" />,
    duplicate: <path d="M4 4v10h10V4H4zm8 8H6V6h6v6zM2 2h10v2H4v8H2V2z" />,
    sortAsc: <path d="M8 2l4 4H4l4-4zm0 12l-4-4h8l-4 4z" />,
    sortDesc: <path d="M8 14l4-4H4l4 4zm0-12l-4 4h8L8 2z" />,
    filter: <path d="M2 3h12l-5 6v5l-2 1V9L2 3z" />,
    hide: <path d="M8 4C3 4 1 8 1 8s2 4 7 4 7-4 7-4-2-4-7-4zm0 6a2 2 0 110-4 2 2 0 010 4z" />,
    delete: <path d="M5 3V2h6v1h4v2H1V3h4zm1 3h1v7H6V6zm3 0h1v7H9V6zM3 5l1 10h8l1-10H3z" />,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] transition-colors"
      style={{
        color: destructive ? 'var(--palette-red)' : 'var(--color-foreground-default)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = destructive ? 'var(--color-background-negative)' : 'var(--opacity-darken1)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        {iconMap[icon]}
      </svg>
      <span>{label}</span>
    </button>
  );
}

// Record Expansion Modal Component
function RecordExpansionModal({
  row,
  columns,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
}: {
  row: RowData;
  columns: GridColumn[];
  onClose: () => void;
  onNavigate: (direction: "prev" | "next") => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="animate-modal-open fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="animate-modal-content flex max-h-[90vh] w-[800px] flex-col overflow-hidden rounded-lg"
        style={{
          backgroundColor: "var(--color-background-default)",
          boxShadow: "var(--elevation-high)",
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--color-border-default)" }}
        >
          <div className="flex items-center gap-2">
            {/* Navigation arrows */}
            <button
              type="button"
              onClick={() => onNavigate("prev")}
              disabled={!hasPrev}
              className="rounded p-1.5 transition-colors disabled:opacity-30"
              style={{ color: "var(--color-foreground-subtle)" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--opacity-darken1)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              aria-label="Previous record"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4l-4 4 4 4V4z" transform="rotate(-90 8 8)" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("next")}
              disabled={!hasNext}
              className="rounded p-1.5 transition-colors disabled:opacity-30"
              style={{ color: "var(--color-foreground-subtle)" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--opacity-darken1)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              aria-label="Next record"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4l-4 4 4 4V4z" transform="rotate(90 8 8)" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy link button */}
            <button
              type="button"
              className="rounded p-1.5 transition-colors"
              style={{ color: "var(--color-foreground-subtle)" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--opacity-darken1)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              aria-label="Copy link"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.5 10.5a2.5 2.5 0 010-3.54l3-3a2.5 2.5 0 013.54 3.54l-1.5 1.5m-4 0a2.5 2.5 0 010 3.54l-3 3a2.5 2.5 0 01-3.54-3.54l1.5-1.5" strokeWidth="1.5" stroke="currentColor" fill="none" />
              </svg>
            </button>
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 transition-colors"
              style={{ color: "var(--color-foreground-subtle)" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--opacity-darken1)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex min-h-0 flex-1">
          {/* Left Panel: Form Fields */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {columns.map((col) => {
                const value = row.cells[col.id];
                return (
                  <div key={col.id}>
                    <label
                      className="mb-1 flex items-center gap-2 text-[13px]"
                      style={{ color: "var(--color-foreground-subtle)" }}
                    >
                      <span style={{ color: "var(--color-foreground-subtle)" }}>
                        {col.type === "NUMBER" ? "#" : "Aa"}
                      </span>
                      <span>{col.name}</span>
                    </label>
                    <div
                      className="min-h-[36px] rounded px-3 py-2 text-[13px]"
                      style={{
                        border: "1px solid var(--color-border-default)",
                        backgroundColor: "var(--color-background-default)",
                      }}
                    >
                      {value === null || value === undefined ? (
                        <span style={{ color: "var(--color-foreground-subtle)" }}>Empty</span>
                      ) : (
                        String(value)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="mt-6 flex items-center gap-2 rounded px-2 py-1 text-[13px] transition-colors"
              style={{ color: "var(--palette-blue)" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--opacity-darken1)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
              <span>Add new field to this table</span>
            </button>
          </div>

          {/* Right Panel: Comments (Placeholder) */}
          <div
            className="w-[280px] flex-shrink-0 overflow-y-auto p-4"
            style={{
              backgroundColor: "var(--palette-neutral-lightGray1)",
              borderLeft: "1px solid var(--color-border-default)",
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[13px] font-medium">Comments</span>
            </div>
            <div
              className="flex flex-col items-center justify-center py-8 text-center"
              style={{ color: "var(--color-foreground-subtle)" }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" className="mb-3 opacity-50">
                <path d="M4 6a2 2 0 012-2h20a2 2 0 012 2v14a2 2 0 01-2 2H10l-6 6V6z" />
              </svg>
              <div className="text-[13px] font-medium" style={{ color: "var(--color-foreground-default)" }}>
                Start a conversation
              </div>
              <p className="mt-1 text-[12px]">
                Ask questions, keep track of status updates, and collaborate with your team.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GridCell(props: {
  rowIndex: number;
  rowId: string;
  columnId: string;
  value: unknown;
}) {
  const { rowIndex, rowId, columnId, value } = props;
  const { focused, setFocused, editing, setEditing, draft, setDraft, startEdit, commitEdit } =
    useGridContext();

  const isFocused = focused?.rowIndex === rowIndex && focused?.columnId === columnId;
  const isEditing = editing?.rowIndex === rowIndex && editing?.columnId === columnId;

  const cellId = `cell-${rowId}-${columnId}`;

  if (isEditing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(null);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            commitEdit("down");
            return;
          }
          if (e.key === "Tab") {
            e.preventDefault();
            commitEdit(e.shiftKey ? "left" : "right");
          }
        }}
        onBlur={() => commitEdit(null)}
        className="h-full w-full rounded-none border-2 bg-white px-2 text-[13px] outline-none"
        style={{ borderColor: 'var(--palette-blue)', boxShadow: 'var(--elevation-low)' }}
      />
    );
  }

  return (
    <div
      id={cellId}
      tabIndex={isFocused ? 0 : -1}
      onMouseDown={(e) => {
        e.preventDefault();
        setFocused({ rowIndex, columnId });
      }}
      onDoubleClick={() => startEdit(rowIndex, columnId)}
      className={
        "relative flex h-full items-center truncate px-2 text-[13px] outline-none transition-colors " +
        (isFocused
          ? "ring-2 ring-inset"
          : "")
      }
      style={isFocused ? {
        backgroundColor: 'var(--color-background-selected-blue)',
        '--tw-ring-color': 'var(--palette-blue)'
      } as React.CSSProperties : undefined}
    >
      {value === null || value === undefined ? "" : String(value)}

      {/* Fill Handle - 6px blue square at bottom-right of selected cell */}
      {isFocused && (
        <div
          className="absolute cursor-crosshair"
          style={{
            width: '6px',
            height: '6px',
            backgroundColor: 'var(--palette-blue)',
            bottom: '-3px',
            right: '-3px',
            zIndex: 5,
          }}
          title="Drag to fill"
        />
      )}
    </div>
  );
}

export function AirtableGrid(props: {
  tableId: string;
  columns: GridColumn[];
  viewId: string | null;
  search: string | null;
  filters: Filters;
  sorts: Sort[];
  rowHeight: RowHeight;
}) {
  const { tableId, columns, search, filters, sorts, viewId, rowHeight } = props;
  const utils = api.useUtils();

  const queryInput = useMemo(
    () => ({
      tableId,
      limit: 200,
      search,
      filters,
      sorts,
      viewId: viewId ?? undefined,
    }),
    [tableId, search, filters, sorts, viewId]
  );

  const rowsQuery = api.row.infinite.useInfiniteQuery(queryInput, {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const countQuery = api.row.count.useQuery(
    {
      tableId,
      search,
      filters,
      viewId: viewId ?? undefined,
    },
    {
      staleTime: 30_000,
    }
  );

  const rows = useMemo<RowData[]>(() => {
    const flat = rowsQuery.data?.pages.flatMap((p) => p.rows) ?? [];
    return flat.map((r) => ({
      id: r.id,
      order: r.order,
      cells: (r.cells ?? {}) as Record<string, unknown>,
    }));
  }, [rowsQuery.data]);

  const focusableColumnIds = useMemo(
    () => columns.map((c) => c.id),
    [columns]
  );

  const [focused, setFocused] = useState<FocusedCell | null>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [columnMenuId, setColumnMenuId] = useState<string | null>(null);

  const updateCell = api.row.updateCell.useMutation({
    onMutate: async ({ rowId, columnId, value }) => {
      await utils.row.infinite.cancel(queryInput);
      const previous = utils.row.infinite.getInfiniteData(queryInput);

      utils.row.infinite.setInfiniteData(queryInput, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            rows: page.rows.map((row: any) =>
              row.id === rowId
                ? {
                    ...row,
                    cells: {
                      ...(row.cells as Record<string, unknown>),
                      [columnId]: value,
                    },
                  }
                : row
            ),
          })),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        utils.row.infinite.setInfiniteData(queryInput, ctx.previous);
      }
    },
  });

  const height = rowHeightPx[rowHeight] ?? 32;

  const moveFrom = (start: FocusedCell, deltaRow: number, deltaCol: number) => {
    const colIndex = focusableColumnIds.indexOf(start.columnId);
    const startCol = colIndex >= 0 ? colIndex : 0;

    let nextRow = start.rowIndex + deltaRow;
    let nextCol = startCol + deltaCol;

    if (nextCol < 0) {
      nextRow -= 1;
      nextCol = focusableColumnIds.length - 1;
    } else if (nextCol >= focusableColumnIds.length) {
      nextRow += 1;
      nextCol = 0;
    }

    nextRow = Math.max(0, Math.min(rows.length - 1, nextRow));
    nextCol = Math.max(0, Math.min(focusableColumnIds.length - 1, nextCol));

    const nextColumnId = focusableColumnIds[nextCol];
    return nextColumnId ? { rowIndex: nextRow, columnId: nextColumnId } : start;
  };

  const startEdit = (rowIndex: number, columnId: string) => {
    const row = rows[rowIndex];
    if (!row) return;
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;

    const current = row.cells[columnId];
    setFocused({ rowIndex, columnId });
    setDraft(current === null || current === undefined ? "" : String(current));
    setEditing({ rowId: row.id, rowIndex, columnId });
  };

  const commitEdit = (move: MoveDirection) => {
    if (!editing) return;
    const col = columns.find((c) => c.id === editing.columnId);
    if (!col) {
      setEditing(null);
      return;
    }

    const parsedValue =
      col.type === "NUMBER"
        ? draft.trim() === ""
          ? null
          : Number(draft)
        : draft;

    updateCell.mutate({
      rowId: editing.rowId,
      columnId: editing.columnId,
      value:
        col.type === "NUMBER" &&
        typeof parsedValue === "number" &&
        Number.isNaN(parsedValue)
          ? null
          : parsedValue,
    });

    const base: FocusedCell = {
      rowIndex: editing.rowIndex,
      columnId: editing.columnId,
    };

    setEditing(null);

    if (!move) return;

    const next =
      move === "left"
        ? moveFrom(base, 0, -1)
        : move === "right"
          ? moveFrom(base, 0, 1)
          : move === "up"
            ? moveFrom(base, -1, 0)
            : moveFrom(base, 1, 0);

    setFocused(next);
  };

  const expandRecord = (rowId: string) => {
    setExpandedRowId(rowId);
  };

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);

  const toggleRowSelection = (rowId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (allSelected) {
      setSelectedRows(new Set());
      setAllSelected(false);
    } else {
      setSelectedRows(new Set(rows.map(r => r.id)));
      setAllSelected(true);
    }
  };

  const columnDefs = useMemo<ColumnDef<RowData>[]>(() => {
    // Checkbox column
    const checkbox: ColumnDef<RowData> = {
      id: "__checkbox",
      header: () => (
        <div
          className="flex h-full items-center justify-center"
          style={{ backgroundColor: 'var(--cell-background-leftPane-header)' }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAllSelection}
            className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300"
            style={{ accentColor: 'var(--palette-blue)' }}
          />
        </div>
      ),
      cell: ({ row }: any) => (
        <div
          className="flex h-full items-center justify-center"
          style={{ backgroundColor: 'var(--cell-background-leftPane-header)' }}
        >
          <input
            type="checkbox"
            checked={selectedRows.has(row.original.id)}
            onChange={() => toggleRowSelection(row.original.id)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300"
            style={{ accentColor: 'var(--palette-blue)' }}
          />
        </div>
      ),
      size: 32,
      enableResizing: false,
    };

    // Row number column
    const rowNum: ColumnDef<RowData> = {
      id: "__rownum",
      header: () => (
        <div
          className="flex h-full items-center justify-center"
          style={{ backgroundColor: 'var(--cell-background-leftPane-header)' }}
        />
      ),
      cell: ({ row }: any) => (
        <div
          className="group flex h-full items-center justify-between px-1 text-[12px]"
          style={{ color: 'var(--palette-gray-500)', backgroundColor: 'var(--cell-background-leftPane-header)' }}
        >
          {/* Expand button - shown on hover */}
          <button
            type="button"
            onClick={() => expandRecord(row.original.id)}
            className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: 'var(--color-foreground-subtle)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Expand record"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h5v2H4v3H2V2zm12 0h-5v2h3v3h2V2zM2 14h5v-2H4v-3H2v5zm12 0h-5v-2h3v-3h2v5z" />
            </svg>
          </button>
          <span className="pr-1">{row.index + 1}</span>
        </div>
      ),
      size: 44,
      enableResizing: false,
    };

    const defs: ColumnDef<RowData>[] = [
      checkbox,
      rowNum,
      ...columns.map((col) => ({
        id: col.id,
        accessorFn: (row: RowData) => row.cells[col.id],
        header: () => (
          <div
            className="group relative flex h-full w-full cursor-pointer items-center gap-2 truncate px-2 text-[13px] font-normal"
            style={{ color: 'var(--color-foreground-default)', backgroundColor: 'var(--cell-background-header)' }}
            onClick={() => setColumnMenuId(columnMenuId === col.id ? null : col.id)}
          >
            {/* Field type icon */}
            {col.type === "NUMBER" ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-foreground-subtle)">
                <path d="M5 2v3H3v2h2v6h2V7h2v6h2V7h2V5h-2V2H9v3H7V2H5zm2 5h2v-2H7v2z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-foreground-subtle)">
                <path d="M2 3h12v2H8.5v8h-2V5H2V3z" />
              </svg>
            )}
            <span className="truncate">{col.name}</span>
            {/* Dropdown indicator */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="ml-auto opacity-0 group-hover:opacity-100"
              style={{ color: 'var(--color-foreground-subtle)' }}
            >
              <path d="M4 6l4 4 4-4H4z" />
            </svg>

            {/* Column Header Menu */}
            {columnMenuId === col.id && (
              <div
                className="animate-dropdown-open absolute left-0 top-full z-50 mt-1 w-52 rounded-md py-1"
                style={{
                  backgroundColor: 'var(--color-background-raised-popover)',
                  boxShadow: 'var(--elevation-medium)',
                  border: '1px solid var(--color-border-default)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <ColumnMenuItem label="Edit field" icon="edit" onClick={() => setColumnMenuId(null)} />
                <ColumnMenuItem label="Duplicate field" icon="duplicate" onClick={() => setColumnMenuId(null)} />
                <div className="my-1 h-px" style={{ backgroundColor: 'var(--color-border-default)' }} />
                <ColumnMenuItem label="Sort A → Z" icon="sortAsc" onClick={() => setColumnMenuId(null)} />
                <ColumnMenuItem label="Sort Z → A" icon="sortDesc" onClick={() => setColumnMenuId(null)} />
                <ColumnMenuItem label="Filter by this field" icon="filter" onClick={() => setColumnMenuId(null)} />
                <div className="my-1 h-px" style={{ backgroundColor: 'var(--color-border-default)' }} />
                <ColumnMenuItem label="Hide field" icon="hide" onClick={() => setColumnMenuId(null)} />
                <ColumnMenuItem label="Delete field" icon="delete" destructive onClick={() => setColumnMenuId(null)} />
              </div>
            )}
          </div>
        ),
        size: col.width ?? 180,
        minSize: 100,
        maxSize: 800,
        cell: (ctx: any) => (
          <GridCell
            rowIndex={ctx.row.index}
            rowId={ctx.row.original.id}
            columnId={ctx.column.id}
            value={ctx.getValue()}
          />
        ),
      })),
    ];

    // Add column button at end
    const addCol: ColumnDef<RowData> = {
      id: "__addcol",
      header: () => (
        <div
          className="flex h-full items-center justify-center"
          style={{ backgroundColor: 'var(--cell-background-header)' }}
        >
          <button
            type="button"
            className="flex h-full w-full items-center justify-center transition-colors"
            style={{ color: 'var(--color-foreground-subtle)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Add column"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </button>
        </div>
      ),
      cell: () => (
        <div
          className="h-full"
          style={{ backgroundColor: 'var(--palette-neutral-white)' }}
        />
      ),
      size: 92,
      enableResizing: false,
    };

    defs.push(addCol);

    return defs;
  }, [columns, columnMenuId, allSelected, selectedRows]);

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rowsQuery.hasNextPage ? rows.length + 1 : rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => height,
    overscan: 10,
  });

  useEffect(() => {
    const items = rowVirtualizer.getVirtualItems();
    const last = items[items.length - 1];
    if (!last) return;

    if (
      last.index >= rows.length - 1 &&
      rowsQuery.hasNextPage &&
      !rowsQuery.isFetchingNextPage
    ) {
      void rowsQuery.fetchNextPage();
    }
  }, [
    rowVirtualizer.getVirtualItems(),
    rows.length,
    rowsQuery.hasNextPage,
    rowsQuery.isFetchingNextPage,
    rowsQuery.fetchNextPage,
  ]);

  useEffect(() => {
    if (!focused) return;
    rowVirtualizer.scrollToIndex(focused.rowIndex, { align: "auto" });

    const row = rows[focused.rowIndex];
    if (!row) return;
    const el = document.getElementById(`cell-${row.id}-${focused.columnId}`);
    if (el instanceof HTMLElement) {
      el.focus();
    }
  }, [focused, rows, rowVirtualizer]);

  const moveFocus = (deltaRow: number, deltaCol: number) => {
    if (!focused) return;
    setFocused(moveFrom(focused, deltaRow, deltaCol));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!focused) return;
    if (editing) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        moveFocus(-1, 0);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveFocus(1, 0);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(0, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveFocus(0, 1);
        break;
      case "Tab":
        e.preventDefault();
        moveFocus(0, e.shiftKey ? -1 : 1);
        break;
      case "Enter":
        e.preventDefault();
        startEdit(focused.rowIndex, focused.columnId);
        break;
      case "Escape":
        e.preventDefault();
        setFocused(null);
        break;
    }
  };

  // Ensure we always have a focused cell when data arrives.
  useEffect(() => {
    if (focused) return;
    if (rows.length === 0) return;
    const first = focusableColumnIds[0];
    if (!first) return;
    setFocused({ rowIndex: 0, columnId: first });
  }, [rows.length, focusableColumnIds, focused]);

  const totalCount = countQuery.data?.count ?? null;

  if (rowsQuery.isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center text-[13px]"
        style={{ color: 'var(--color-foreground-subtle)' }}
      >
        Loading records…
      </div>
    );
  }

  if (rowsQuery.isError) {
    return (
      <div
        className="flex h-full items-center justify-center text-[13px]"
        style={{ color: 'var(--palette-red)' }}
      >
        Failed to load rows.
      </div>
    );
  }

  const tableRows = table.getRowModel().rows;
  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <GridContext.Provider
      value={{
        focused,
        setFocused,
        editing,
        setEditing,
        draft,
        setDraft,
        startEdit,
        commitEdit,
        expandRecord,
        columns,
      }}
    >
      <div className="flex h-full flex-col">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-auto outline-none"
        style={{ backgroundColor: 'var(--palette-neutral-lightGray1)' }}
      >
        <div style={{ width: table.getTotalSize() }}>
          {/* Header */}
          <div
            className="sticky top-0 z-10"
            style={{
              height,
              backgroundColor: 'var(--cell-background-header)',
              borderBottom: '1px solid var(--color-border-cell-bottom)'
            }}
          >
            {table.getHeaderGroups().map((hg) => (
              <div key={hg.id} className="flex" style={{ height }}>
                {hg.headers.map((header) => (
                  <div
                    key={header.id}
                    className="relative flex items-center"
                    style={{
                      width: header.getSize(),
                      height,
                      borderRight: '1px solid var(--color-border-cell)'
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}

                    {header.column.getCanResize() ? (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors"
                        style={{
                          backgroundColor: header.column.getIsResizing()
                            ? 'var(--palette-blue)'
                            : 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          if (!header.column.getIsResizing()) {
                            e.currentTarget.style.backgroundColor = 'var(--palette-gray-200)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!header.column.getIsResizing()) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Body */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {virtualItems.map((virtualRow) => {
              const isLoader = virtualRow.index >= tableRows.length;
              const row = tableRows[virtualRow.index];

              if (!isLoader && !row) return null;

              return (
                <div
                  key={virtualRow.key}
                  className="flex transition-colors"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                    backgroundColor: 'var(--palette-neutral-white)',
                    borderBottom: '1px solid var(--color-border-cell-bottom)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoader) {
                      e.currentTarget.style.backgroundColor = 'var(--palette-neutral-lightGray1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoader) {
                      e.currentTarget.style.backgroundColor = 'var(--palette-neutral-white)';
                    }
                  }}
                >
                  {isLoader ? (
                    <div
                      className="flex w-full items-center justify-center text-[13px]"
                      style={{ height: virtualRow.size, color: 'var(--color-foreground-subtle)' }}
                    >
                      {rowsQuery.hasNextPage
                        ? "Loading more…"
                        : rows.length
                          ? "End of table"
                          : "No records"}
                    </div>
                  ) : (
                    row!.getVisibleCells().map((cell) => (
                      <div
                        key={cell.id}
                        style={{
                          width: cell.column.getSize(),
                          height: virtualRow.size,
                          borderRight: '1px solid var(--color-border-cell)'
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div
        className="flex items-center gap-2 px-2"
        style={{
          height: '32px',
          minHeight: '32px',
          backgroundColor: 'var(--palette-neutral-white)',
          borderTop: '1px solid var(--color-border-cell-bottom)',
        }}
      >
        {/* Add row button */}
        <button
          type="button"
          className="flex items-center justify-center rounded p-1 transition-colors"
          style={{ color: 'var(--color-foreground-subtle)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="Add row"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Scissors/Add button */}
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-[13px] transition-colors"
          style={{ color: 'var(--color-foreground-subtle)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 4a2 2 0 11-4 0 2 2 0 014 0zM6 12a2 2 0 11-4 0 2 2 0 014 0zM5.5 6l8-4M5.5 10l8 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <span>Add...</span>
        </button>

        {/* Record count */}
        <div className="text-[13px]" style={{ color: 'var(--color-foreground-subtle)' }}>
          {totalCount === null
            ? ""
            : `${totalCount.toLocaleString()} record${totalCount === 1 ? "" : "s"}`}
          {rowsQuery.isFetchingNextPage ? " · Loading…" : ""}
        </div>
      </div>
      </div>

      {/* Record Expansion Modal */}
      {expandedRowId && (() => {
        const expandedRow = rows.find((r) => r.id === expandedRowId);
        if (!expandedRow) return null;
        const rowIndex = rows.findIndex((r) => r.id === expandedRowId);
        return (
          <RecordExpansionModal
            row={expandedRow}
            columns={columns}
            onClose={() => setExpandedRowId(null)}
            onNavigate={(dir) => {
              const newIndex = dir === "prev" ? rowIndex - 1 : rowIndex + 1;
              const newRow = rows[newIndex];
              if (newRow) setExpandedRowId(newRow.id);
            }}
            hasPrev={rowIndex > 0}
            hasNext={rowIndex < rows.length - 1}
          />
        );
      })()}
    </GridContext.Provider>
  );
}
