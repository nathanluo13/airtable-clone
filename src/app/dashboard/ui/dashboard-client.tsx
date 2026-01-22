"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "~/trpc/react";
import { AirtableGrid } from "~/components/airtable/airtable-grid";
import { Header } from "~/components/airtable/header";
import { HomePage } from "~/components/airtable/home-page";
import { AppRail } from "~/components/airtable/app-rail";
import { Icon } from "~/components/ui/icon";

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

type DashboardClientProps = {
  userName: string;
  userEmail: string;
};

export function DashboardClient({ userName, userEmail }: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  const baseParam = searchParams.get("base");
  const tableParam = searchParams.get("table");
  const viewParam = searchParams.get("view");

  const [activePanel, setActivePanel] = useState<
    null | "hide" | "filter" | "group" | "sort" | "color" | "rowHeight" | "tools"
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
    router.replace(`/dashboard${qs ? `?${qs}` : ""}`, { scroll: false });
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
  const [toolbarSearchOpen, setToolbarSearchOpen] = useState(false);
  const toolbarSearchRef = useRef<HTMLInputElement>(null);

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
        userName={userName}
        userEmail={userEmail}
      />
    );
  }

  const currentBase = bases.find((b) => b.id === baseId);
  const currentBaseName = currentBase?.name ?? "Untitled Base";
  const baseColor = currentBase?.color ?? null;
  const baseIcon = currentBase?.icon ?? null;
  const baseTint = "var(--palette-green-light3)";

  return (
    <main
      className="flex h-screen text-[13px]"
      style={{ backgroundColor: 'var(--color-background-default)', color: 'var(--color-foreground-default)' }}
    >
      {/* App Rail (44px) - Full Height */}
      <AppRail
        userName={userName}
        userEmail={userEmail}
        onHomeClick={() => setParams({ base: null, table: null, view: null })}
      />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header (57px) - Full Width - White background */}
        <Header
        baseName={currentBaseName}
        baseColor={baseColor ?? "var(--palette-green)"}
        baseIcon={baseIcon}
      />

      {/* Table Selector Bar (32px) - Full Width */}
      <div
        className="flex items-center justify-between pr-3"
        style={{
          height: 'var(--table-tabs-height)',
          minHeight: 'var(--table-tabs-height)',
          backgroundColor: baseTint,
          borderBottom: '1px solid var(--color-border-default)'
        }}
      >
        {/* Left side: Table tabs + dropdown + Add or import */}
        <div className="flex items-end gap-0 h-full">
          {/* Table Tabs */}
          {tables.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setParams({ table: t.id, view: null })}
              className="flex items-center gap-1.5 px-3 text-[13px] transition-colors rounded-t-md"
              style={{
                backgroundColor: t.id === tableId ? 'var(--color-background-default)' : 'transparent',
                color: 'var(--color-foreground-default)',
                fontWeight: t.id === tableId ? 500 : 400,
                height: 'calc(100% + 1px)',
                marginBottom: '-1px',
              }}
              onMouseEnter={(e) => {
                if (t.id !== tableId) e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
              }}
              onMouseLeave={(e) => {
                if (t.id !== tableId) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span>{t.name}</span>
              {t.id === tableId && (
                <Icon name="ChevronDownSmall" size={14} className="text-[var(--color-foreground-subtle)]" />
              )}
            </button>
          ))}

          {/* More tables dropdown - just an icon, no hover */}
          <div
            className="flex items-center self-center px-1 cursor-pointer"
            style={{ color: 'var(--color-foreground-default)' }}
          >
            <Icon name="ChevronDownSmall" size={18} />
          </div>

          {/* Add or import - centered, hover makes text bold */}
          <button
            type="button"
            className="flex items-center gap-1 self-center px-2 text-[13px] ml-1"
            style={{ color: 'var(--color-foreground-subtle)' }}
            onMouseEnter={(e) => { e.currentTarget.style.fontWeight = '600'; }}
            onMouseLeave={(e) => { e.currentTarget.style.fontWeight = '400'; }}
          >
            <Icon name="Plus" size={14} />
            <span>Add or import</span>
          </button>
        </div>

        {/* Right side: Tools only */}
        <button
          type="button"
          className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
          style={{
            backgroundColor: activePanel === 'tools' ? 'var(--color-background-selected-blue)' : 'transparent',
            color: activePanel === 'tools' ? 'var(--palette-blue)' : 'var(--color-foreground-subtle)',
          }}
          onMouseEnter={(e) => {
            if (activePanel !== 'tools') e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
          }}
          onMouseLeave={(e) => {
            if (activePanel !== 'tools') e.currentTarget.style.backgroundColor = 'transparent';
          }}
          onClick={() => setActivePanel((p) => (p === 'tools' ? null : 'tools'))}
        >
          <span>Tools</span>
          <Icon name="ChevronDownSmall" size={14} className="opacity-60" />
        </button>
      </div>

      {/* Toolbar (36px) - Full Width */}
      <div
        className="relative flex items-center justify-between gap-3 px-3"
        style={{
          height: 'var(--toolbar-height)',
          minHeight: 'var(--toolbar-height)',
          backgroundColor: 'var(--color-background-default)',
          borderBottom: '1px solid var(--color-border-default)'
        }}
      >
        {/* Left side: View selector */}
        <div className="flex items-center gap-2">
          {/* Collapse Sidebar Button */}
          <button
            type="button"
            className="rounded p-1.5 transition-colors"
            style={{ color: 'var(--color-foreground-subtle)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h8v2H2v-2z" />
            </svg>
          </button>

          {/* View Type Dropdown */}
          <button
            type="button"
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] font-medium transition-colors"
            style={{ color: 'var(--color-foreground-default)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Icon name="GridFeature" size={14} className="text-[var(--palette-blue)]" />
            <span>{views.find((v) => v.id === viewId)?.name ?? "Grid view"}</span>
            <Icon name="ChevronDownSmall" size={14} className="text-[var(--color-foreground-subtle)]" />
          </button>
        </div>

        {/* Right side: Filters */}
        <div className="flex items-center gap-1">
          {/* Add 100k rows */}
          <button
            type="button"
            onClick={() => { if (tableId) add100k.mutate({ tableId }); }}
            disabled={add100k.isPending || !tableId}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
            style={{
              color: 'var(--color-foreground-subtle)',
              opacity: add100k.isPending ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!add100k.isPending) e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Icon name="Plus" size={14} />
            <span>{add100k.isPending ? "Adding..." : "Add 100k rows"}</span>
          </button>

          {/* Hide fields */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePanel((p) => (p === "hide" ? null : "hide"))}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
              style={{
                backgroundColor: activePanel === "hide" ? 'var(--color-background-selected-blue)' : 'transparent',
                color: activePanel === "hide" ? 'var(--palette-blue)' : 'var(--color-foreground-subtle)'
              }}
              onMouseEnter={(e) => { if (activePanel !== "hide") e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'; }}
              onMouseLeave={(e) => { if (activePanel !== "hide") e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Icon name="EyeSlash" size={14} />
              <span>Hide fields</span>
            </button>
            {/* Hide fields dropdown */}
            {activePanel === "hide" && (
              <div
                className="animate-dropdown-open absolute right-0 top-full z-30 mt-1 w-[280px] rounded-md p-3"
                style={{
                  backgroundColor: 'var(--color-background-raised-popover)',
                  border: '1px solid var(--color-border-default)',
                  boxShadow: 'var(--elevation-medium)'
                }}
              >
                <input
                  value={hideSearch}
                  onChange={(e) => setHideSearch(e.target.value)}
                  placeholder="Find a field"
                  className="mb-2 h-8 w-full rounded px-3 text-[13px] outline-none"
                  style={{
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-background-default)'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--palette-blue)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-default)'}
                />
                <div className="max-h-64 overflow-auto">
                  {columns.filter((c) => c.name.toLowerCase().includes(hideSearch.toLowerCase())).map((c) => {
                    const isVisible = columnVisibility[c.id] !== false;
                    return (
                      <div
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 transition-colors"
                        onClick={() => setColumnVisibility((prev) => ({ ...prev, [c.id]: prev[c.id] === false }))}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div className="relative h-4 w-7 shrink-0 rounded-full transition-colors" style={{ backgroundColor: isVisible ? 'var(--palette-teal-dusty)' : 'var(--palette-gray-300)' }}>
                          <div className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all" style={{ left: isVisible ? '14px' : '2px' }} />
                        </div>
                        <Icon name={c.type === "NUMBER" ? "Hash" : "TextAa"} size={14} className="shrink-0 text-[var(--color-foreground-subtle)]" />
                        <span className="flex-1 truncate text-[13px]" style={{ color: 'var(--color-foreground-default)' }}>{c.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2 border-t pt-2" style={{ borderColor: 'var(--color-border-default)' }}>
                  <button type="button" onClick={() => { const h: Record<string, boolean> = {}; columns.forEach((c) => { h[c.id] = false; }); setColumnVisibility(h); }} className="flex-1 rounded py-1.5 text-[13px] transition-colors" style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-foreground-default)', backgroundColor: 'var(--color-background-default)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background-default)'}>Hide all</button>
                  <button type="button" onClick={() => { const v: Record<string, boolean> = {}; columns.forEach((c) => { v[c.id] = true; }); setColumnVisibility(v); }} className="flex-1 rounded py-1.5 text-[13px] transition-colors" style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-foreground-default)', backgroundColor: 'var(--color-background-default)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background-default)'}>Show all</button>
                </div>
              </div>
            )}
          </div>

          {/* Filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePanel((p) => (p === "filter" ? null : "filter"))}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
              style={{
                backgroundColor: filters.conditions.length > 0 ? 'var(--palette-green-light3)' : activePanel === "filter" ? 'var(--color-background-selected-blue)' : 'transparent',
                color: filters.conditions.length > 0 ? 'var(--palette-green-dark1)' : activePanel === "filter" ? 'var(--palette-blue)' : 'var(--color-foreground-subtle)'
              }}
              onMouseEnter={(e) => { if (filters.conditions.length === 0 && activePanel !== "filter") e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'; }}
              onMouseLeave={(e) => { if (filters.conditions.length === 0 && activePanel !== "filter") e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Icon name="FunnelSimple" size={14} />
              <span>{filters.conditions.length > 0 ? `${filters.conditions.length} filter${filters.conditions.length > 1 ? 's' : ''}` : 'Filter'}</span>
            </button>
            {/* Filter dropdown */}
            {activePanel === "filter" && (
              <div
                className="animate-dropdown-open absolute right-0 top-full z-30 mt-1 min-w-[400px] rounded-md p-3"
                style={{
                  backgroundColor: 'var(--color-background-raised-popover)',
                  border: '1px solid var(--color-border-default)',
                  boxShadow: 'var(--elevation-medium)'
                }}
              >
                {/* Filter Header */}
                <div className="mb-3 text-[14px] font-medium" style={{ color: 'var(--color-foreground-default)' }}>Filter</div>

                {/* AI Input */}
                <div
                  className="mb-3 flex items-center gap-2 rounded-md px-3 py-2"
                  style={{ backgroundColor: 'var(--palette-neutral-lightGray1)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--color-foreground-ai)">
                    <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11l-1.5-3.5L3 6l3.5-1.5L8 1zm4 6l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM4 10l.67 1.33L6 12l-1.33.67L4 14l-.67-1.33L2 12l1.33-.67L4 10z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Describe what you want to see"
                    className="flex-1 bg-transparent text-[13px] outline-none"
                    style={{ color: 'var(--color-foreground-subtle)' }}
                  />
                </div>

                {/* "In this view, show records" text */}
                <div className="mb-3 text-[13px]" style={{ color: 'var(--color-foreground-default)' }}>
                  In this view, show records
                </div>

                <div className="space-y-2">
                  {filters.conditions.map((f, idx) => {
                    const col = columns.find((c) => c.id === f.columnId);
                    const ops = operatorsForType(col?.type ?? "TEXT");
                    const needsValue = f.operator !== "isEmpty" && f.operator !== "isNotEmpty";

                    return (
                      <div key={idx} className="flex items-center gap-2">
                        {idx === 0 ? (
                          <span className="w-[52px] shrink-0 text-[13px]" style={{ color: 'var(--color-foreground-subtle)' }}>
                            Where
                          </span>
                        ) : (
                          <select
                            value={filters.conjunction}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                conjunction: e.target.value === "or" ? "or" : "and",
                              }))
                            }
                            className="h-8 w-[52px] shrink-0 rounded border-0 bg-transparent px-0 text-[13px]"
                            style={{ color: 'var(--color-foreground-subtle)' }}
                          >
                            <option value="and">and</option>
                            <option value="or">or</option>
                          </select>
                        )}
                        <select
                          value={f.columnId}
                          onChange={(e) => {
                            const columnId = e.target.value;
                            setFilters((prev) => ({
                              ...prev,
                              conditions: prev.conditions.map((c, i) =>
                                i === idx ? { ...c, columnId, operator: "contains", value: "" } : c
                              ),
                            }));
                          }}
                          className="h-8 w-[90px] shrink-0 rounded px-2 text-[13px]"
                          style={{ border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-background-default)' }}
                        >
                          <option value="" disabled>Field</option>
                          {columns.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
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
                          className="h-8 w-[100px] shrink-0 rounded px-2 text-[13px]"
                          style={{ border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-background-default)' }}
                        >
                          {ops.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>

                        {needsValue && (
                          <input
                            value={f.value === null || f.value === undefined ? "" : String(f.value)}
                            placeholder="Enter a value"
                            onChange={(e) => {
                              const v = e.target.value;
                              setFilters((prev) => ({
                                ...prev,
                                conditions: prev.conditions.map((c, i) =>
                                  i === idx ? { ...c, value: v } : c
                                ),
                              }));
                            }}
                            className="h-8 min-w-[80px] flex-1 rounded px-2 text-[13px] outline-none"
                            style={{ border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-background-default)' }}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--palette-blue)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-default)'}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              conditions: prev.conditions.filter((_, i) => i !== idx),
                            }))
                          }
                          className="shrink-0 rounded p-1.5 transition-colors"
                          style={{ color: 'var(--color-foreground-subtle)' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M5 2V1h6v1h4v1h-1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V3H1V2h4zm1 3v8h1V5H6zm3 0v8h1V5H9z"/>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Default condition row when no conditions exist */}
                {filters.conditions.length === 0 && columns.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-[52px] shrink-0 text-[13px]" style={{ color: 'var(--color-foreground-subtle)' }}>
                      Where
                    </span>
                    <select
                      defaultValue={columns[0]?.id ?? ""}
                      onChange={(e) => {
                        const columnId = e.target.value;
                        const col = columns.find((c) => c.id === columnId);
                        setFilters((prev) => ({
                          ...prev,
                          conditions: [{
                            columnId,
                            operator: col?.type === "NUMBER" ? "gt" : "contains",
                            value: "",
                          }],
                        }));
                      }}
                      className="h-8 w-[90px] shrink-0 rounded px-2 text-[13px]"
                      style={{ border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-background-default)' }}
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    <select
                      defaultValue="contains"
                      className="h-8 w-[100px] shrink-0 rounded px-2 text-[13px]"
                      style={{ border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-background-default)' }}
                    >
                      <option value="contains">contains</option>
                      <option value="notContains">does not contain</option>
                      <option value="equals">is</option>
                      <option value="isEmpty">is empty</option>
                      <option value="isNotEmpty">is not empty</option>
                    </select>

                    <input
                      placeholder="Enter a value"
                      className="h-8 min-w-[80px] flex-1 rounded px-2 text-[13px] outline-none"
                      style={{ border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-background-default)' }}
                      onFocus={(e) => e.currentTarget.style.borderColor = 'var(--palette-blue)'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-default)'}
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
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
                    className="flex items-center gap-1 text-[13px] transition-colors"
                    style={{ color: 'var(--palette-teal-dark1)' }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span>Add condition</span>
                  </button>

                  <button
                    type="button"
                    className="flex items-center gap-1 text-[13px] transition-colors"
                    style={{ color: 'var(--color-foreground-subtle)' }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span>Add condition group</span>
                  </button>

                  <div className="flex-1" />

                  <button
                    type="button"
                    className="text-[13px] transition-colors"
                    style={{ color: 'var(--color-foreground-subtle)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-foreground-default)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-foreground-subtle)'}
                  >
                    Copy from another view
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Group */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePanel((p) => (p === "group" ? null : "group"))}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
              style={{
                backgroundColor: activePanel === "group" ? 'var(--color-background-selected-blue)' : 'transparent',
                color: activePanel === "group" ? 'var(--palette-blue)' : 'var(--color-foreground-subtle)'
              }}
              onMouseEnter={(e) => { if (activePanel !== "group") e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'; }}
              onMouseLeave={(e) => { if (activePanel !== "group") e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Icon name="Group" size={14} />
              <span>Group</span>
            </button>
            {/* Group dropdown */}
            {activePanel === "group" && (
              <div
                className="animate-dropdown-open absolute right-0 top-full z-30 mt-1 w-[280px] rounded-md p-3"
                style={{
                  backgroundColor: 'var(--color-background-raised-popover)',
                  border: '1px solid var(--color-border-default)',
                  boxShadow: 'var(--elevation-medium)'
                }}
              >
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
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePanel((p) => (p === "sort" ? null : "sort"))}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
              style={{
                backgroundColor: sorts.length > 0 ? 'var(--palette-green-light3)' : activePanel === "sort" ? 'var(--color-background-selected-blue)' : 'transparent',
                color: sorts.length > 0 ? 'var(--palette-green-dark1)' : activePanel === "sort" ? 'var(--palette-blue)' : 'var(--color-foreground-subtle)'
              }}
              onMouseEnter={(e) => { if (sorts.length === 0 && activePanel !== "sort") e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'; }}
              onMouseLeave={(e) => { if (sorts.length === 0 && activePanel !== "sort") e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Icon name="ArrowsDownUp" size={14} />
              <span>{sorts.length > 0 ? `Sorted by ${sorts.length} field${sorts.length > 1 ? 's' : ''}` : 'Sort'}</span>
            </button>
            {/* Sort dropdown */}
            {activePanel === "sort" && (
              <div
                className="animate-dropdown-open absolute right-0 top-full z-30 mt-1 w-[320px] rounded-md p-3"
                style={{
                  backgroundColor: 'var(--color-background-raised-popover)',
                  border: '1px solid var(--color-border-default)',
                  boxShadow: 'var(--elevation-medium)'
                }}
              >
                {/* Sort by header with info icon */}
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="text-[14px] font-medium" style={{ color: 'var(--color-foreground-default)' }}>Sort by</span>
                  <button
                    type="button"
                    className="rounded-full p-0.5 transition-colors"
                    style={{ color: 'var(--color-foreground-subtle)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a1 1 0 110 2 1 1 0 010-2zm2 8H6v-1h1V8H6V7h3v4h1v1z" />
                    </svg>
                  </button>
                </div>

                {/* Sort rows */}
                <div className="space-y-2">
                  {sorts.map((sort, idx) => {
                    const col = columns.find((c) => c.id === sort.columnId);
                    const isText = col?.type !== "NUMBER";
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={sort.columnId}
                          onChange={(e) => {
                            const columnId = e.target.value;
                            setSorts((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, columnId } : s))
                            );
                          }}
                          className="h-8 flex-1 rounded px-2 text-[13px]"
                          style={{ border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-background-default)' }}
                        >
                          {columns.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>

                        <select
                          value={sort.direction}
                          onChange={(e) => {
                            const direction = e.target.value === "desc" ? "desc" : "asc";
                            setSorts((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, direction } : s))
                            );
                          }}
                          className="h-8 w-[100px] shrink-0 rounded px-2 text-[13px]"
                          style={{ border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-background-default)' }}
                        >
                          <option value="asc">{isText ? 'A → Z' : '1 → 9'}</option>
                          <option value="desc">{isText ? 'Z → A' : '9 → 1'}</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => setSorts((prev) => prev.filter((_, i) => i !== idx))}
                          className="shrink-0 rounded p-1.5 transition-colors"
                          style={{ color: 'var(--color-foreground-subtle)' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
                          </svg>
                        </button>
                      </div>
                    );
                  })}

                  {/* Default sort row when no sorts exist */}
                  {sorts.length === 0 && columns.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value=""
                        onChange={(e) => {
                          const columnId = e.target.value;
                          if (columnId) {
                            setSorts([{ columnId, direction: "asc" }]);
                          }
                        }}
                        className="h-8 flex-1 rounded px-2 text-[13px]"
                        style={{ border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-background-default)' }}
                      >
                        <option value="" disabled>Pick a field to sort by</option>
                        {columns.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>

                      <select
                        value="asc"
                        disabled
                        className="h-8 w-[100px] shrink-0 rounded px-2 text-[13px]"
                        style={{ border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-background-default)' }}
                      >
                        <option value="asc">A → Z</option>
                        <option value="desc">Z → A</option>
                      </select>

                      <button
                        type="button"
                        disabled
                        className="shrink-0 rounded p-1.5 opacity-30"
                        style={{ color: 'var(--color-foreground-subtle)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Add another sort */}
                <button
                  type="button"
                  onClick={() => {
                    const first = columns[0];
                    if (!first) return;
                    setSorts((prev) => [...prev, { columnId: first.id, direction: "asc" }]);
                  }}
                  className="mt-3 flex items-center gap-1 text-[13px] transition-colors"
                  style={{ color: 'var(--color-foreground-subtle)' }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>Add another sort</span>
                </button>

                {/* Divider */}
                <div className="my-3 h-px" style={{ backgroundColor: 'var(--color-border-default)' }} />

                {/* Automatically sort records toggle */}
                <label className="flex cursor-pointer items-center gap-2">
                  <div
                    className="relative h-5 w-9 rounded-full transition-colors"
                    style={{ backgroundColor: 'var(--palette-teal-dusty)' }}
                  >
                    <div
                      className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                    />
                  </div>
                  <span className="text-[13px]" style={{ color: 'var(--color-foreground-default)' }}>
                    Automatically sort records
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Color */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePanel((p) => (p === "color" ? null : "color"))}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
              style={{
                backgroundColor: activePanel === "color" ? 'var(--color-background-selected-blue)' : 'transparent',
                color: activePanel === "color" ? 'var(--palette-blue)' : 'var(--color-foreground-subtle)'
              }}
              onMouseEnter={(e) => { if (activePanel !== "color") e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'; }}
              onMouseLeave={(e) => { if (activePanel !== "color") e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Icon name="Palette" size={14} />
              <span>Color</span>
            </button>
            {/* Color dropdown */}
            {activePanel === "color" && (
              <div
                className="animate-dropdown-open absolute right-0 top-full z-30 mt-1 w-[280px] rounded-md p-3"
                style={{
                  backgroundColor: 'var(--color-background-raised-popover)',
                  border: '1px solid var(--color-border-default)',
                  boxShadow: 'var(--elevation-medium)'
                }}
              >
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
            )}
          </div>

          <div className="mx-1 h-4 w-px" style={{ backgroundColor: 'var(--color-border-default)' }} />

          {/* Share and sync */}
          <button
            type="button"
            className="flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors"
            style={{ color: 'var(--color-foreground-subtle)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Icon name="Share" size={14} />
            <span>Share and sync</span>
          </button>

          {/* Search */}
          {toolbarSearchOpen ? (
            <div className="relative ml-2">
              <Icon name="MagnifyingGlass" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-foreground-subtle)]" />
              <input
                ref={toolbarSearchRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search"
                className="h-8 w-[180px] rounded pl-8 pr-3 text-[13px] outline-none transition-colors"
                style={{ border: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-background-default)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--palette-blue)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
              />
            </div>
          ) : null}

          <button
            type="button"
            className="rounded p-1.5 transition-colors"
            style={{ color: 'var(--color-foreground-subtle)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="Search"
            onClick={() => {
              setToolbarSearchOpen((open) => {
                const next = !open;
                if (next) setTimeout(() => toolbarSearchRef.current?.focus(), 0);
                return next;
              });
            }}
          >
            <Icon name="MagnifyingGlass" size={14} />
          </button>
        </div>
      </div>

      {/* Main Content: Sidebar | Grid Container */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside
          className="flex flex-col overflow-hidden"
          style={{
            width: 'var(--sidebar-width)',
            minWidth: 'var(--sidebar-width)',
            backgroundColor: 'var(--color-background-default)',
            borderRight: '1px solid var(--color-border-default)'
          }}
        >
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
              className="flex h-8 w-full items-center gap-2 rounded px-2 text-[13px] transition-colors disabled:opacity-50"
              style={{ color: 'var(--color-foreground-default)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Icon name="Plus" size={14} className="text-[var(--palette-blue)]" />
              <span>Create new...</span>
            </button>

            {/* Find a view search + Options row */}
            <div className="mt-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Icon
                  name="MagnifyingGlass"
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-foreground-subtle)]"
                />
                <input
                  value={viewSearch}
                  onChange={(e) => setViewSearch(e.target.value)}
                  placeholder="Find a view"
                  className="h-8 w-full rounded pl-8 pr-2 text-[13px] outline-none transition-colors"
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
                aria-label="View list settings"
              >
                <Icon name="Cog" size={14} />
              </button>
            </div>
          </div>

          {/* View List */}
          <div className="flex-1 overflow-y-auto px-2">
            {views
              .filter(v => !viewSearch || v.name.toLowerCase().includes(viewSearch.toLowerCase()))
              .map((v) => {
                const type = String((v as any).type ?? "grid").toLowerCase();
                const isActive = v.id === viewId;
                const iconName =
                  type === "gallery" ? "GalleryFeature" : type === "group" ? "Group" : "GridFeature";
                const iconColor = type === "gallery" ? "text-[var(--palette-purple)]" : "text-[var(--palette-blue)]";

                return (
                  <div
                    key={v.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setParams({ view: v.id })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setParams({ view: v.id });
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[13px] transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isActive ? 'var(--color-background-selected)' : 'transparent',
                      color: 'var(--color-foreground-default)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'var(--opacity-darken1)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Icon name={iconName} size={14} className={`shrink-0 ${iconColor}`} />
                    <span className="flex-1 truncate">{v.name}</span>
                  </div>
                );
              })}
          </div>

        </aside>

        {/* Grid Container */}
        <section className="flex min-w-0 flex-1 flex-col">
          {/* Grid */}
          <div
            className="min-h-0 flex-1"
            style={{ backgroundColor: 'var(--color-background-default)' }}
          >
            {tableQuery.isLoading || tablesQuery.isLoading ? (
              <div
                className="flex h-full items-center justify-center text-[13px]"
                style={{ color: 'var(--color-foreground-subtle)' }}
              >
                {tablesQuery.isLoading ? 'Loading tables…' : 'Loading table…'}
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
      </div>
    </main>
  );
}
