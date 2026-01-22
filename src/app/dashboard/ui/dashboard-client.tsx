"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "~/trpc/react";
import { AirtableGrid } from "~/components/airtable/airtable-grid";
import { Header } from "~/components/airtable/header";
import { HomePage } from "~/components/airtable/home-page";

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

type ViewConfig = {
  search: string | null;
  filters: Filters;
  sorts: Sort[];
  columnVisibility: Record<string, boolean>;
  rowHeight: "short" | "medium" | "tall" | "extra_tall";
};

const defaultFilters: Filters = { conjunction: "and", conditions: [] };

function normalizeViewConfig(config: unknown, columnIds: string[]): ViewConfig {
  const cfg = (config ?? {}) as Record<string, unknown>;

  const search = typeof cfg.search === "string" ? cfg.search : null;

  const filtersRaw = (cfg.filters ?? {}) as Record<string, unknown>;
  const conjunction =
    filtersRaw.conjunction === "or" ? "or" : ("and" as const);

  const conditionsRaw = Array.isArray(filtersRaw.conditions)
    ? (filtersRaw.conditions as unknown[])
    : [];

  const conditions: FilterCondition[] = conditionsRaw
    .map((c) => c as Record<string, unknown>)
    .map((c) => {
      const columnId = typeof c.columnId === "string" ? c.columnId : "";
      const operator = c.operator as FilterOperator;
      const value = c.value as any;
      return { columnId, operator, value };
    })
    .filter((c) => Boolean(c.columnId));

  const sortsRaw = Array.isArray(cfg.sorts) ? (cfg.sorts as unknown[]) : [];
  const sorts: Sort[] = sortsRaw
    .map((s) => s as Record<string, unknown>)
    .map((s) => ({
      columnId: typeof s.columnId === "string" ? s.columnId : "",
      direction: s.direction === "desc" ? ("desc" as const) : ("asc" as const),
    }))
    .filter((s) => Boolean(s.columnId));

  const visibilityRaw = (cfg.columnVisibility ?? {}) as Record<string, unknown>;
  const columnVisibility: Record<string, boolean> = Object.fromEntries(
    columnIds.map((id) => [id, visibilityRaw[id] !== false])
  );

  const rowHeight =
    cfg.rowHeight === "medium" ||
    cfg.rowHeight === "tall" ||
    cfg.rowHeight === "extra_tall"
      ? cfg.rowHeight
      : ("short" as const);

  return {
    search,
    filters: { conjunction, conditions },
    sorts,
    columnVisibility,
    rowHeight,
  };
}

function operatorsForType(type: string): Array<{ value: FilterOperator; label: string }> {
  if (type === "NUMBER") {
    return [
      { value: "gt", label: ">" },
      { value: "lt", label: "<" },
      { value: "equals", label: "=" },
      { value: "isEmpty", label: "is empty" },
      { value: "isNotEmpty", label: "is not empty" },
    ];
  }

  return [
    { value: "contains", label: "contains" },
    { value: "notContains", label: "not contains" },
    { value: "equals", label: "equals" },
    { value: "isEmpty", label: "is empty" },
    { value: "isNotEmpty", label: "is not empty" },
  ];
}

export function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  const baseParam = searchParams.get("base");
  const tableParam = searchParams.get("table");
  const viewParam = searchParams.get("view");

  const [activePanel, setActivePanel] = useState<
    null | "hide" | "filter" | "group" | "sort" | "color" | "rowHeight"
  >(null);

  const basesQuery = api.base.list.useQuery(undefined, {
    staleTime: 60_000,
  });
  const bases = basesQuery.data ?? [];

  // Only use baseId if explicitly set in URL params
  const baseId = useMemo(() => {
    if (baseParam && bases.some((b) => b.id === baseParam)) return baseParam;
    return null; // Don't auto-select first base - show home page instead
  }, [baseParam, bases]);

  const setParams = (patch: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : "?");
  };

  // Don't auto-redirect - let the user stay on home page

  const tablesQuery = api.table.listByBase.useQuery(
    { baseId: baseId ?? "" },
    { enabled: Boolean(baseId), staleTime: 60_000 }
  );
  const tables = tablesQuery.data ?? [];

  const tableId = useMemo(() => {
    if (tableParam && tables.some((t) => t.id === tableParam)) return tableParam;
    return tables[0]?.id ?? null;
  }, [tableParam, tables]);

  useEffect(() => {
    if (!tableId) return;
    if (tableParam !== tableId) {
      setParams({ table: tableId, view: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  const tableQuery = api.table.get.useQuery(
    { tableId: tableId ?? "" },
    { enabled: Boolean(tableId), staleTime: 60_000 }
  );
  const table = tableQuery.data;
  const columns = table?.columns ?? [];
  const views = table?.views ?? [];

  const viewId = useMemo(() => {
    if (!views.length) return null;
    if (viewParam && views.some((v) => v.id === viewParam)) return viewParam;
    return views.find((v) => v.isDefault)?.id ?? views[0]!.id;
  }, [viewParam, views]);

  useEffect(() => {
    if (!viewId) return;
    if (viewParam !== viewId) {
      setParams({ view: viewId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sorts, setSorts] = useState<Sort[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [rowHeight, setRowHeight] = useState<ViewConfig["rowHeight"]>("short");

  // Initialize local state from the selected view config.
  useEffect(() => {
    if (!columns.length) return;
    const columnIds = columns.map((c) => c.id);
    const view = views.find((v) => v.id === viewId);
    const normalized = normalizeViewConfig(view?.config, columnIds);

    setSearchInput(normalized.search ?? "");
    setSearch(normalized.search);
    setFilters(normalized.filters);
    setSorts(normalized.sorts);
    setColumnVisibility(normalized.columnVisibility);
    setRowHeight(normalized.rowHeight);
  }, [viewId, tableId, columns.length]);

  // Debounce search input.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim() ? searchInput : null);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const visibleColumns = useMemo(() => {
    if (!columns.length) return [];
    return columns.filter((c) => columnVisibility[c.id] !== false);
  }, [columns, columnVisibility]);

  const createBase = api.base.create.useMutation({
    onSuccess: async (created) => {
      await utils.base.list.invalidate();
      setParams({ base: created.id, table: null, view: null });
    },
  });

  const createTable = api.table.createWithDefaults.useMutation({
    onSuccess: async (created) => {
      await utils.table.listByBase.invalidate();
      await utils.base.list.invalidate();
      setParams({ table: created.id, view: null });
    },
  });

  const createView = api.view.create.useMutation({
    onSuccess: async (created) => {
      await utils.table.get.invalidate();
      setParams({ view: created.id });
    },
  });

  const updateViewConfig = api.view.updateConfig.useMutation({
    onSuccess: async () => {
      await utils.table.get.invalidate();
    },
  });

  const autoSaveRef = useRef(false);
  useEffect(() => {
    if (!viewId) return;
    if (!autoSaveRef.current) {
      autoSaveRef.current = true;
      return;
    }

    const handle = setTimeout(() => {
      updateViewConfig.mutate({
        viewId,
        patch: {
          search,
          filters,
          sorts,
          columnVisibility,
          rowHeight,
        },
      });
    }, 600);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, search, filters, sorts, columnVisibility, rowHeight]);

  const addColumn = api.column.create.useMutation({
    onSuccess: async (col) => {
      await utils.table.get.invalidate({ tableId: tableId ?? "" });
      setColumnVisibility((prev) => ({ ...prev, [col.id]: true }));
    },
  });

  const addRow = api.row.addRow.useMutation({
    onSuccess: async () => {
      await utils.row.infinite.invalidate();
      await utils.row.count.invalidate();
    },
  });

  const add100k = api.row.generate100k.useMutation({
    onSuccess: async () => {
      await utils.row.infinite.invalidate();
      await utils.row.count.invalidate();
    },
  });

  const [hideSearch, setHideSearch] = useState("");
  const [viewSearch, setViewSearch] = useState("");

  if (basesQuery.isLoading) {
    return (
      <main
        className="flex h-screen items-center justify-center text-[13px]"
        style={{ backgroundColor: 'var(--color-background-default)', color: 'var(--color-foreground-subtle)' }}
      >
        Loading…
      </main>
    );
  }

  // Show home page when no base is selected
  if (!baseId) {
    return (
      <HomePage
        bases={bases}
        onSelectBase={(id) => setParams({ base: id, table: null, view: null })}
        onCreateBase={(name) => createBase.mutate({ name })}
        isCreating={createBase.isPending}
      />
    );
  }

  const currentBaseName = bases.find((b) => b.id === baseId)?.name ?? "Untitled Base";

  return (
    <main
      className="flex h-screen flex-col text-[13px]"
      style={{ backgroundColor: 'var(--color-background-default)', color: 'var(--color-foreground-default)' }}
    >
      {/* Header (57px) - Full Width */}
      <Header baseName={currentBaseName} />

      {/* Table Tabs Bar (32px) - Full Width */}
      <div
        className="flex items-center justify-between px-3"
        style={{
          height: 'var(--table-tabs-height)',
          minHeight: 'var(--table-tabs-height)',
          backgroundColor: 'var(--palette-neutral-lightGray1)',
          borderBottom: '1px solid var(--color-border-default)'
        }}
      >
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {tables.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setParams({ table: t.id, view: null })}
              className="rounded-t px-3 py-1.5 text-[13px] transition-colors"
              style={{
                backgroundColor: t.id === tableId ? 'var(--color-background-default)' : 'transparent',
                borderTop: t.id === tableId ? '2px solid var(--palette-teal-dusty)' : '2px solid transparent',
                marginTop: t.id === tableId ? '2px' : '0',
              }}
              onMouseEnter={(e) => {
                if (t.id !== tableId) e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
              }}
              onMouseLeave={(e) => {
                if (t.id !== tableId) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {t.name}
            </button>
          ))}
          <button
            type="button"
            disabled={!baseId || createTable.isPending}
            onClick={() => {
              if (!baseId) return;
              const name = window.prompt("Table name?");
              if (!name) return;
              createTable.mutate({ baseId, name });
            }}
            className="rounded px-2 py-1 text-[13px] transition-colors disabled:opacity-50"
            style={{ color: 'var(--palette-blue)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            +
          </button>
        </div>
      </div>

      {/* Main Content: Sidebar | Grid Container */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar (264px) */}
        <aside
          className="flex flex-col overflow-hidden"
          style={{
            width: 'var(--sidebar-width)',
            minWidth: 'var(--sidebar-width)',
            backgroundColor: 'var(--palette-neutral-lightGray1)',
            borderRight: '1px solid var(--color-border-default)'
          }}
        >
          {/* View Toolbar */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderBottom: '1px solid var(--color-border-default)' }}
          >
            {/* Collapse Sidebar Button */}
            <button
              type="button"
              className="rounded p-1.5 transition-colors"
              style={{ color: 'var(--color-foreground-subtle)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="Close sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h8v2H2v-2z" />
              </svg>
            </button>

            {/* View Type Dropdown */}
            <button
              type="button"
              className="flex flex-1 items-center gap-1.5 rounded px-2 py-1.5 text-[13px] font-medium transition-colors"
              style={{ color: 'var(--color-foreground-default)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z" />
              </svg>
              <span>Grid view</span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="ml-auto">
                <path d="M4 6l4 4 4-4H4z" />
              </svg>
            </button>
          </div>

          {/* Create New + Search + Options */}
          <div className="px-3 py-2">
            {/* Create New Button */}
            <button
              type="button"
              disabled={!tableId || createView.isPending}
              onClick={() => {
                if (!tableId) return;
                const name = window.prompt("View name?");
                if (!name) return;
                createView.mutate({ tableId, name });
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-[13px] transition-colors disabled:opacity-50"
              style={{ color: 'var(--color-foreground-default)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v12M2 8h12" stroke="var(--palette-blue)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Create...</span>
            </button>

            {/* Find a view search + Options row */}
            <div className="mt-2 flex items-center gap-2">
              <div className="relative flex-1">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="var(--color-foreground-subtle)"
                  className="absolute left-2 top-1/2 -translate-y-1/2"
                >
                  <path d="M11.5 11.5L14 14M6.5 11a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                <input
                  value={viewSearch}
                  onChange={(e) => setViewSearch(e.target.value)}
                  placeholder="Find a view"
                  className="h-7 w-full rounded pl-7 pr-2 text-[13px] outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--color-background-default)',
                    border: '1px solid var(--color-border-default)'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--palette-blue)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-default)'}
                />
              </div>
              <button
                type="button"
                className="rounded p-1.5 transition-colors"
                style={{ color: 'var(--color-foreground-subtle)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                aria-label="View list options"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 9.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                </svg>
              </button>
            </div>
          </div>

          {/* View List */}
          <div className="flex-1 overflow-y-auto px-2">
            {views
              .filter(v => !viewSearch || v.name.toLowerCase().includes(viewSearch.toLowerCase()))
              .map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setParams({ view: v.id })}
                className="group flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[13px] transition-colors"
                style={{
                  backgroundColor: v.id === viewId ? 'var(--color-background-selected-blue)' : 'transparent',
                  color: v.id === viewId ? 'var(--palette-blue)' : 'var(--color-foreground-default)'
                }}
                onMouseEnter={(e) => {
                  if (v.id !== viewId) e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
                }}
                onMouseLeave={(e) => {
                  if (v.id !== viewId) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z" />
                </svg>
                <span className="flex-1 truncate">{v.name}</span>

                {/* Hover buttons - Menu and Settings */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); }}
                    className="rounded p-1 transition-colors"
                    style={{ color: 'var(--color-foreground-subtle)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    aria-label="View menu"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 6l4 4 4-4H4z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); }}
                    className="rounded p-1 transition-colors"
                    style={{ color: 'var(--color-foreground-subtle)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    aria-label="View settings"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 10a2 2 0 100-4 2 2 0 000 4zm6-2c0-.3 0-.6-.1-.9l1.6-1.2-1.5-2.6-1.9.5c-.4-.4-.9-.7-1.4-.9L10 1H7l-.7 1.9c-.5.2-1 .5-1.4.9l-1.9-.5-1.5 2.6 1.6 1.2c-.1.3-.1.6-.1.9s0 .6.1.9L1.5 10.1l1.5 2.6 1.9-.5c.4.4.9.7 1.4.9L7 15h3l.7-1.9c.5-.2 1-.5 1.4-.9l1.9.5 1.5-2.6-1.6-1.2c.1-.3.1-.6.1-.9z" />
                    </svg>
                  </button>
                </div>
              </button>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderTop: '1px solid var(--color-border-default)' }}
          >
            <div className="flex items-center gap-1">
              {/* Help Button */}
              <button
                type="button"
                className="rounded p-2 transition-colors"
                style={{ color: 'var(--color-foreground-subtle)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                aria-label="Help"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12a1 1 0 110-2 1 1 0 010 2zm1-4.5V9H7v-.5a2.5 2.5 0 112.5-2.5H8a1 1 0 100-2 1 1 0 00-1 1H5.5a2.5 2.5 0 015 0c0 .88-.46 1.7-1.2 2.16-.26.16-.3.24-.3.34z" />
                </svg>
              </button>

              {/* Notifications Button */}
              <button
                type="button"
                className="rounded p-2 transition-colors"
                style={{ color: 'var(--color-foreground-subtle)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                aria-label="Notifications"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 14c1.1 0 2-.9 2-2H6c0 1.1.9 2 2 2zm5-3V7c0-2.5-1.7-4.6-4-5.2V1c0-.6-.4-1-1-1s-1 .4-1 1v.8C4.7 2.4 3 4.5 3 7v4l-1 1v1h12v-1l-1-1z" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-1">
              {updateViewConfig.isPending ? (
                <span className="text-[12px]" style={{ color: 'var(--color-foreground-subtle)' }}>Saving…</span>
              ) : (
                <span className="text-[12px]" style={{ color: 'var(--color-foreground-subtle)' }}>Saved</span>
              )}
            </div>
          </div>
        </aside>

        {/* Grid Container */}
        <section className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar (36px) */}
          <div
            className="relative flex items-center justify-between gap-3 px-3"
            style={{
              height: 'var(--toolbar-height)',
              minHeight: 'var(--toolbar-height)',
              backgroundColor: 'var(--color-background-default)',
              borderBottom: '1px solid var(--color-border-default)'
            }}
          >
            <div className="flex items-center gap-1">
              {/* Hide fields */}
              <button
                type="button"
                onClick={() =>
                  setActivePanel((p) => (p === "hide" ? null : "hide"))
                }
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
                style={{
                  backgroundColor: activePanel === "hide" ? 'var(--color-background-selected-blue)' : 'transparent',
                  color: activePanel === "hide" ? 'var(--palette-blue)' : 'var(--color-foreground-subtle)'
                }}
                onMouseEnter={(e) => {
                  if (activePanel !== "hide") e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
                }}
                onMouseLeave={(e) => {
                  if (activePanel !== "hide") e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 4C3 4 1 8 1 8s2 4 7 4 7-4 7-4-2-4-7-4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
                <span>Hide fields</span>
              </button>

              {/* Filter */}
              <button
                type="button"
                onClick={() =>
                  setActivePanel((p) => (p === "filter" ? null : "filter"))
                }
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
                style={{
                  backgroundColor: filters.conditions.length > 0
                    ? 'var(--palette-green-light3)'
                    : activePanel === "filter"
                      ? 'var(--color-background-selected-blue)'
                      : 'transparent',
                  color: filters.conditions.length > 0
                    ? 'var(--palette-green-dark1)'
                    : activePanel === "filter"
                      ? 'var(--palette-blue)'
                      : 'var(--color-foreground-subtle)'
                }}
                onMouseEnter={(e) => {
                  if (filters.conditions.length === 0 && activePanel !== "filter") e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
                }}
                onMouseLeave={(e) => {
                  if (filters.conditions.length === 0 && activePanel !== "filter") e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 3h12l-5 6v5l-2 1V9L2 3z" />
                </svg>
                <span>{filters.conditions.length > 0 ? `${filters.conditions.length} filter${filters.conditions.length > 1 ? 's' : ''}` : 'Filter'}</span>
              </button>

              {/* Group */}
              <button
                type="button"
                onClick={() =>
                  setActivePanel((p) => (p === "group" ? null : "group"))
                }
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
                style={{
                  backgroundColor: activePanel === "group" ? 'var(--color-background-selected-blue)' : 'transparent',
                  color: activePanel === "group" ? 'var(--palette-blue)' : 'var(--color-foreground-subtle)'
                }}
                onMouseEnter={(e) => {
                  if (activePanel !== "group") e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
                }}
                onMouseLeave={(e) => {
                  if (activePanel !== "group") e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 2h6v3H1V2zm0 5h6v3H1V7zm0 5h6v3H1v-3zm8-10h6v3H9V2zm0 5h6v3H9V7zm0 5h6v3H9v-3z" />
                </svg>
                <span>Group</span>
              </button>

              {/* Sort */}
              <button
                type="button"
                onClick={() =>
                  setActivePanel((p) => (p === "sort" ? null : "sort"))
                }
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
                style={{
                  backgroundColor: sorts.length > 0
                    ? 'var(--palette-orange-light2)'
                    : activePanel === "sort"
                      ? 'var(--color-background-selected-blue)'
                      : 'transparent',
                  color: sorts.length > 0
                    ? 'var(--palette-orange-dark1)'
                    : activePanel === "sort"
                      ? 'var(--palette-blue)'
                      : 'var(--color-foreground-subtle)'
                }}
                onMouseEnter={(e) => {
                  if (sorts.length === 0 && activePanel !== "sort") e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
                }}
                onMouseLeave={(e) => {
                  if (sorts.length === 0 && activePanel !== "sort") e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 1v14l-3-3h6l-3 3V1H4zm7 4h4l-2-3-2 3zm0 2v8h4V7h-4z" />
                </svg>
                <span>{sorts.length > 0 ? `Sorted by ${sorts.length} field${sorts.length > 1 ? 's' : ''}` : 'Sort'}</span>
              </button>

              {/* Color */}
              <button
                type="button"
                onClick={() =>
                  setActivePanel((p) => (p === "color" ? null : "color"))
                }
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
                style={{
                  backgroundColor: activePanel === "color" ? 'var(--color-background-selected-blue)' : 'transparent',
                  color: activePanel === "color" ? 'var(--palette-blue)' : 'var(--color-foreground-subtle)'
                }}
                onMouseEnter={(e) => {
                  if (activePanel !== "color") e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
                }}
                onMouseLeave={(e) => {
                  if (activePanel !== "color") e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13 1l-9 9 3 3 9-9-3-3zM3 11l-2 4 4-2-2-2z" />
                </svg>
                <span>Color</span>
              </button>

              {/* Row Height */}
              <button
                type="button"
                onClick={() =>
                  setActivePanel((p) => (p === "rowHeight" ? null : "rowHeight"))
                }
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
                style={{
                  backgroundColor: activePanel === "rowHeight" ? 'var(--color-background-selected-blue)' : 'transparent',
                  color: activePanel === "rowHeight" ? 'var(--palette-blue)' : 'var(--color-foreground-subtle)'
                }}
                onMouseEnter={(e) => {
                  if (activePanel !== "rowHeight") e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
                }}
                onMouseLeave={(e) => {
                  if (activePanel !== "rowHeight") e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z" />
                </svg>
              </button>

              <div
                className="mx-1 h-4 w-px"
                style={{ backgroundColor: 'var(--color-border-default)' }}
              />

              {/* Share and sync */}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
                style={{ color: 'var(--color-foreground-subtle)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12 4a2 2 0 11-4 0 2 2 0 014 0zm-6 8a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM7 5l-3 5m8 0L9 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                <span>Share and sync</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="var(--color-foreground-subtle)"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2"
                >
                  <path d="M11.5 11.5L14 14M6.5 11a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search"
                  className="h-7 w-[180px] rounded pl-8 pr-3 text-[13px] outline-none transition-colors"
                  style={{
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-background-default)'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--palette-blue)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-default)'}
                />
              </div>
            </div>
          </div>

          {/* Panels (positioned below toolbar) */}
          {activePanel ? (
            <div
              className="animate-dropdown-open absolute left-[calc(var(--sidebar-width)+12px)] z-20 mt-[calc(var(--header-height)+var(--table-tabs-height)+var(--toolbar-height)+4px)] min-w-[320px] max-w-[400px] rounded-md"
              style={{
                backgroundColor: 'var(--color-background-raised-popover)',
                border: '1px solid var(--color-border-default)',
                boxShadow: 'var(--elevation-medium)'
              }}
            >
              {activePanel === "hide" ? (
                <div className="p-3">
                  <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-foreground-default)' }}>Hide fields</div>
                  <input
                    value={hideSearch}
                    onChange={(e) => setHideSearch(e.target.value)}
                    placeholder="Find a field"
                    className="mb-3 h-8 w-full rounded px-3 text-sm outline-none"
                    style={{
                      border: '1px solid var(--color-border-default)',
                      backgroundColor: 'var(--color-background-default)'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--palette-blue)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-default)'}
                  />
                  <div className="max-h-64 overflow-auto">
                    {columns
                      .filter((c) =>
                        c.name.toLowerCase().includes(hideSearch.toLowerCase())
                      )
                      .map((c) => (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 transition-colors"
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <input
                            type="checkbox"
                            checked={columnVisibility[c.id] !== false}
                            onChange={() =>
                              setColumnVisibility((prev) => ({
                                ...prev,
                                [c.id]: prev[c.id] === false,
                              }))
                            }
                          />
                          <span className="text-sm">{c.name}</span>
                        </label>
                      ))}
                  </div>
                </div>
              ) : null}

              {activePanel === "filter" ? (
                <div className="p-3">
                  {/* AI Input */}
                  <div
                    className="mb-3 flex items-center gap-2 rounded px-3 py-2"
                    style={{ backgroundColor: 'var(--palette-neutral-lightGray1)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--color-foreground-ai)">
                      <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11l-1.5-3.5L3 6l3.5-1.5L8 1zm4 6l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM4 10l.67 1.33L6 12l-1.33.67L4 14l-.67-1.33L2 12l1.33-.67L4 10z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Describe what you want to see"
                      className="flex-1 bg-transparent text-[13px] outline-none"
                      style={{ color: 'var(--color-foreground-default)' }}
                    />
                  </div>

                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-foreground-default)' }}>Filter</div>
                    <div className="flex items-center gap-2">
                      <select
                        value={filters.conjunction}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            conjunction: e.target.value === "or" ? "or" : "and",
                          }))
                        }
                        className="h-7 rounded px-2 text-[13px]"
                        style={{ border: '1px solid var(--color-border-default)' }}
                      >
                        <option value="and">AND</option>
                        <option value="or">OR</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setFilters(defaultFilters)}
                        className="rounded px-2 py-1 text-[13px] transition-colors"
                        style={{ color: 'var(--color-foreground-subtle)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filters.conditions.map((f, idx) => {
                      const col = columns.find((c) => c.id === f.columnId);
                      const ops = operatorsForType(col?.type ?? "TEXT");
                      const needsValue =
                        f.operator !== "isEmpty" && f.operator !== "isNotEmpty";

                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={f.columnId}
                            onChange={(e) => {
                              const columnId = e.target.value;
                              setFilters((prev) => ({
                                ...prev,
                                conditions: prev.conditions.map((c, i) =>
                                  i === idx
                                    ? {
                                        ...c,
                                        columnId,
                                        operator: "contains",
                                        value: "",
                                      }
                                    : c
                                ),
                              }));
                            }}
                            className="h-8 w-[200px] rounded px-2 text-sm"
                            style={{ border: '1px solid var(--color-border-default)' }}
                          >
                            <option value="" disabled>
                              Field
                            </option>
                            {columns.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          <select
                            value={f.operator}
                            onChange={(e) => {
                              const operator = e.target.value as FilterOperator;
                              setFilters((prev) => ({
                                ...prev,
                                conditions: prev.conditions.map((c, i) =>
                                  i === idx ? { ...c, operator } : c
                                ),
                              }));
                            }}
                            className="h-8 w-[140px] rounded px-2 text-sm"
                            style={{ border: '1px solid var(--color-border-default)' }}
                          >
                            {ops.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>

                          {needsValue ? (
                            <input
                              value={
                                f.value === null || f.value === undefined
                                  ? ""
                                  : String(f.value)
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                setFilters((prev) => ({
                                  ...prev,
                                  conditions: prev.conditions.map((c, i) =>
                                    i === idx ? { ...c, value: v } : c
                                  ),
                                }));
                              }}
                              className="h-8 flex-1 rounded px-2 text-sm outline-none"
                              style={{ border: '1px solid var(--color-border-default)' }}
                              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--palette-blue)'}
                              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-default)'}
                            />
                          ) : null}

                          <button
                            type="button"
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                conditions: prev.conditions.filter((_, i) => i !== idx),
                              }))
                            }
                            className="rounded px-2 py-1 text-sm transition-colors"
                            style={{ color: 'var(--color-foreground-subtle)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Empty state */}
                  {filters.conditions.length === 0 && (
                    <div
                      className="mb-3 flex items-center gap-2 rounded px-3 py-3"
                      style={{ backgroundColor: 'var(--palette-neutral-lightGray1)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-foreground-subtle)">
                        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm1 11H7v-2h2v2zm0-4H7V4h2v4z" />
                      </svg>
                      <span className="text-[13px]" style={{ color: 'var(--color-foreground-subtle)' }}>
                        No filter conditions are applied
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const first = columns[0];
                        if (!first) return;
                        setFilters((prev) => ({
                          ...prev,
                          conditions: [
                            ...prev.conditions,
                            {
                              columnId: first.id,
                              operator: first.type === "NUMBER" ? "gt" : "contains",
                              value: "",
                            },
                          ],
                        }));
                      }}
                      className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
                      style={{ color: 'var(--palette-blue)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <span>Add condition</span>
                    </button>

                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
                      style={{ color: 'var(--color-foreground-subtle)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <span>Add condition group</span>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm1 11H7v-2h2v2zm0-4H7V4h2v4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : null}

              {activePanel === "sort" ? (
                <div className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-foreground-default)' }}>Sort</div>
                    <button
                      type="button"
                      onClick={() => setSorts([])}
                      className="rounded px-2 py-1 text-sm transition-colors"
                      style={{ color: 'var(--color-foreground-subtle)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={sorts[0]?.columnId ?? ""}
                      onChange={(e) => {
                        const columnId = e.target.value;
                        setSorts(columnId ? [{ columnId, direction: "asc" }] : []);
                      }}
                      className="h-8 w-[240px] rounded px-2 text-sm"
                      style={{ border: '1px solid var(--color-border-default)' }}
                    >
                      <option value="">Field</option>
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={sorts[0]?.direction ?? "asc"}
                      onChange={(e) => {
                        const direction = e.target.value === "desc" ? "desc" : "asc";
                        setSorts((prev) =>
                          prev.length ? [{ ...prev[0]!, direction }] : prev
                        );
                      }}
                      className="h-8 w-[160px] rounded px-2 text-sm"
                      style={{ border: '1px solid var(--color-border-default)' }}
                      disabled={!sorts.length}
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </div>
                </div>
              ) : null}

              {activePanel === "group" ? (
                <div className="p-3">
                  <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-foreground-default)' }}>Group</div>
                  <p className="mb-3 text-[13px]" style={{ color: 'var(--color-foreground-subtle)' }}>
                    Group records by a field to organize your data.
                  </p>
                  <select
                    className="h-8 w-full rounded px-2 text-sm"
                    style={{ border: '1px solid var(--color-border-default)' }}
                  >
                    <option value="">Pick a field to group by</option>
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {activePanel === "color" ? (
                <div className="p-3">
                  <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-foreground-default)' }}>Color</div>
                  <p className="mb-3 text-[13px]" style={{ color: 'var(--color-foreground-subtle)' }}>
                    Apply colors to rows based on field values.
                  </p>
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded p-2 transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <input type="radio" name="colorMode" defaultChecked className="accent-[var(--palette-blue)]" />
                      <div>
                        <div className="text-[13px]" style={{ color: 'var(--color-foreground-default)' }}>None</div>
                        <div className="text-[12px]" style={{ color: 'var(--color-foreground-subtle)' }}>No row coloring</div>
                      </div>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded p-2 transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <input type="radio" name="colorMode" className="accent-[var(--palette-blue)]" />
                      <div>
                        <div className="text-[13px]" style={{ color: 'var(--color-foreground-default)' }}>Select field</div>
                        <div className="text-[12px]" style={{ color: 'var(--color-foreground-subtle)' }}>Color by single select field</div>
                      </div>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded p-2 transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <input type="radio" name="colorMode" className="accent-[var(--palette-blue)]" />
                      <div>
                        <div className="text-[13px]" style={{ color: 'var(--color-foreground-default)' }}>Conditions</div>
                        <div className="text-[12px]" style={{ color: 'var(--color-foreground-subtle)' }}>Color rows based on conditions</div>
                      </div>
                    </label>
                  </div>
                </div>
              ) : null}

              {activePanel === "rowHeight" ? (
                <div className="p-3">
                  <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-foreground-default)' }}>Row height</div>
                  <div className="space-y-1">
                    {[
                      { id: 'short' as const, label: 'Short', height: '32px' },
                      { id: 'medium' as const, label: 'Medium', height: '56px' },
                      { id: 'tall' as const, label: 'Tall', height: '88px' },
                      { id: 'extra_tall' as const, label: 'Extra tall', height: '120px' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setRowHeight(option.id)}
                        className="flex w-full items-center gap-3 rounded px-3 py-2 text-[13px] transition-colors"
                        style={{
                          backgroundColor: rowHeight === option.id ? 'var(--color-background-selected-blue)' : 'transparent',
                          color: rowHeight === option.id ? 'var(--palette-blue)' : 'var(--color-foreground-default)'
                        }}
                        onMouseEnter={(e) => {
                          if (rowHeight !== option.id) e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
                        }}
                        onMouseLeave={(e) => {
                          if (rowHeight !== option.id) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z" />
                        </svg>
                        <span>{option.label}</span>
                        <span className="ml-auto text-[12px]" style={{ color: 'var(--color-foreground-subtle)' }}>{option.height}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Grid */}
          <div
            className="min-h-0 flex-1"
            style={{ backgroundColor: 'var(--palette-neutral-lightGray1)' }}
          >
            {tableQuery.isLoading ? (
              <div
                className="flex h-full items-center justify-center text-[13px]"
                style={{ color: 'var(--color-foreground-subtle)' }}
              >
                Loading table…
              </div>
            ) : !tableId ? (
              <div
                className="flex h-full flex-col items-center justify-center gap-4 text-[13px]"
                style={{ color: 'var(--color-foreground-subtle)' }}
              >
                <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" className="opacity-40">
                  <path d="M1 2h14v2H1V2zm0 4h14v2H1V6zm0 4h14v2H1v-2zm0 4h14v2H1v-2z" />
                </svg>
                <p>No tables yet</p>
                <button
                  type="button"
                  disabled={!baseId || createTable.isPending}
                  onClick={() => {
                    if (!baseId) return;
                    const name = window.prompt("Table name?");
                    if (!name) return;
                    createTable.mutate({ baseId, name });
                  }}
                  className="rounded-md px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: 'var(--palette-blue)', color: 'white' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--palette-blue-dark1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--palette-blue)')}
                >
                  {createTable.isPending ? 'Creating...' : 'Create your first table'}
                </button>
              </div>
            ) : (
              <AirtableGrid
                tableId={tableId}
                columns={visibleColumns}
                search={search}
                filters={filters}
                sorts={sorts}
                rowHeight={rowHeight}
                viewId={viewId}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
