import { TRPCError } from "@trpc/server";
import { faker } from "@faker-js/faker";
import { z } from "zod";

import { Prisma } from "../../../../generated/prisma";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const cuid = z.string().cuid();

const filterOperatorSchema = z.enum([
  // Text
  "contains",
  "notContains",
  "equals",
  "isEmpty",
  "isNotEmpty",
  // Number
  "gt",
  "lt",
]);

const filterConditionSchema = z.object({
  columnId: cuid,
  operator: filterOperatorSchema,
  value: z.union([z.string(), z.number(), z.null()]).optional(),
});

const filtersSchema = z.object({
  conjunction: z.enum(["and", "or"]).default("and"),
  conditions: z.array(filterConditionSchema).default([]),
});

const sortSchema = z.object({
  columnId: cuid,
  direction: z.enum(["asc", "desc"]),
});

type FilterCondition = z.infer<typeof filterConditionSchema>;
type Filters = z.infer<typeof filtersSchema>;
type Sort = z.infer<typeof sortSchema>;

function buildSearchSQL(search: string | null | undefined, columnIds: string[]) {
  const q = (search ?? "").trim();
  if (!q || columnIds.length === 0) return Prisma.sql`TRUE`;

  const like = `%${q}%`;
  const conditions = columnIds.map((columnId) => {
    const path = `COALESCE(cells->>'${columnId}', '')`;
    return Prisma.sql`${Prisma.raw(path)} ILIKE ${like}`;
  });

  return Prisma.join(conditions, " OR ");
}

function buildFilterSQL(filters: Filters, columnTypes: Map<string, string>) {
  const conditions: Prisma.Sql[] = [];

  for (const f of filters.conditions) {
    const type = columnTypes.get(f.columnId) ?? "TEXT";
    const rawPath = `cells->>'${f.columnId}'`;

    if (type === "NUMBER") {
      const numeric = Prisma.raw(`NULLIF(${rawPath}, '')::numeric`);
      switch (f.operator) {
        case "gt":
          conditions.push(Prisma.sql`${numeric} > ${Number(f.value)}`);
          break;
        case "lt":
          conditions.push(Prisma.sql`${numeric} < ${Number(f.value)}`);
          break;
        case "equals":
          conditions.push(Prisma.sql`${numeric} = ${Number(f.value)}`);
          break;
        case "isEmpty":
          conditions.push(
            Prisma.sql`(${Prisma.raw(rawPath)} IS NULL OR ${Prisma.raw(rawPath)} = '')`
          );
          break;
        case "isNotEmpty":
          conditions.push(
            Prisma.sql`(${Prisma.raw(rawPath)} IS NOT NULL AND ${Prisma.raw(rawPath)} != '')`
          );
          break;
        default:
          break;
      }
      continue;
    }

    // TEXT (default)
    const text = Prisma.raw(rawPath);
    switch (f.operator) {
      case "contains":
        conditions.push(Prisma.sql`${text} ILIKE ${"%" + String(f.value ?? "") + "%"}`);
        break;
      case "notContains":
        conditions.push(
          Prisma.sql`COALESCE(${text}, '') NOT ILIKE ${"%" + String(f.value ?? "") + "%"}`
        );
        break;
      case "equals":
        conditions.push(Prisma.sql`${text} = ${String(f.value ?? "")}`);
        break;
      case "isEmpty":
        conditions.push(Prisma.sql`(${text} IS NULL OR ${text} = '')`);
        break;
      case "isNotEmpty":
        conditions.push(Prisma.sql`(${text} IS NOT NULL AND ${text} != '')`);
        break;
      default:
        break;
    }
  }

  if (conditions.length === 0) return Prisma.sql`TRUE`;
  return Prisma.join(
    conditions,
    filters.conjunction === "or" ? " OR " : " AND "
  );
}

function getPrimarySort(sorts: Sort[] | undefined): Sort | null {
  if (!sorts || sorts.length === 0) return null;
  return sorts[0] ?? null;
}

export const rowRouter = createTRPCRouter({
  infinite: protectedProcedure
    .input(
      z.object({
        tableId: cuid,
        limit: z.number().min(1).max(200).default(100),
        cursor: z
          .object({
            id: cuid,
            order: z.number().optional(),
            sortValue: z.union([z.string(), z.number(), z.null()]).optional(),
          })
          .nullish(),
        search: z.string().max(200).optional().nullable(),
        filters: filtersSchema.optional(),
        sorts: z.array(sortSchema).optional(),
        viewId: cuid.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { tableId, limit, cursor } = input;

      const table = await ctx.db.table.findFirst({
        where: { id: tableId, base: { userId: ctx.dbUser.id } },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND" });

      // Load columns (needed for DB-level filter/sort/search semantics)
      const columns = await ctx.db.column.findMany({
        where: { tableId },
        select: { id: true, type: true },
      });
      const columnTypes = new Map(columns.map((c) => [c.id, c.type]));
      const searchableColumnIds = columns.map((c) => c.id);

      // View config (optional)
      let mergedSearch = input.search ?? null;
      let mergedFilters: Filters = input.filters ?? {
        conjunction: "and",
        conditions: [],
      };
      let mergedSorts: Sort[] = input.sorts ?? [];

      if (input.viewId) {
        const view = await ctx.db.view.findFirst({
          where: { id: input.viewId, table: { base: { userId: ctx.dbUser.id } } },
          select: { config: true },
        });
        if (view) {
          const parsed = z
            .object({
              search: z.string().max(200).nullable().optional(),
              filters: filtersSchema.optional(),
              sorts: z.array(sortSchema).optional(),
            })
            .safeParse(view.config);

          if (parsed.success) {
            mergedSearch = parsed.data.search ?? mergedSearch;
            mergedFilters = parsed.data.filters ?? mergedFilters;
            mergedSorts = parsed.data.sorts ?? mergedSorts;
          }
        }
      }

      const searchSQL = buildSearchSQL(mergedSearch, searchableColumnIds);
      const filterSQL = buildFilterSQL(mergedFilters, columnTypes);
      const primarySort = getPrimarySort(mergedSorts);

      let cursorSQL = Prisma.empty;
      let orderBySQL: Prisma.Sql = Prisma.sql`"order" ASC, id ASC`;

      if (!primarySort) {
        if (cursor?.order !== undefined) {
          cursorSQL = Prisma.sql`AND ("order", id) > (${cursor.order}, ${cursor.id})`;
        }
      } else {
        const colType = columnTypes.get(primarySort.columnId) ?? "TEXT";
        const dir = primarySort.direction;

        const sortKey =
          colType === "NUMBER"
            ? Prisma.raw(
                `NULLIF(cells->>'${primarySort.columnId}', '')::numeric`
              )
            : Prisma.raw(`NULLIF(cells->>'${primarySort.columnId}', '')`);

        orderBySQL =
          dir === "desc"
            ? Prisma.sql`${sortKey} DESC NULLS LAST, id DESC`
            : Prisma.sql`${sortKey} ASC NULLS LAST, id ASC`;

        if (cursor) {
          const cursorId = cursor.id;
          const cursorVal = cursor.sortValue ?? null;

          if (cursorVal === null) {
            cursorSQL =
              dir === "desc"
                ? Prisma.sql`AND (${sortKey} IS NULL AND id < ${cursorId})`
                : Prisma.sql`AND (${sortKey} IS NULL AND id > ${cursorId})`;
          } else {
            const typedCursorVal =
              colType === "NUMBER" ? Number(cursorVal) : String(cursorVal);

            cursorSQL =
              dir === "desc"
                ? Prisma.sql`AND ((${sortKey}, id) < (${typedCursorVal}, ${cursorId}) OR ${sortKey} IS NULL)`
                : Prisma.sql`AND ((${sortKey}, id) > (${typedCursorVal}, ${cursorId}) OR ${sortKey} IS NULL)`;
          }
        }
      }

      const rows = await ctx.db.$queryRaw<
        Array<{
          id: string;
          order: number;
          cells: unknown;
          createdAt: Date;
          updatedAt: Date;
        }>
      >(Prisma.sql`
        SELECT id, "order", cells, "createdAt", "updatedAt"
        FROM "Row"
        WHERE "tableId" = ${tableId}
          AND (${filterSQL})
          AND (${searchSQL})
          ${cursorSQL}
        ORDER BY ${orderBySQL}
        LIMIT ${limit + 1}
      `);

      let nextCursor: typeof cursor | undefined = undefined;
      if (rows.length > limit) {
        const last = rows.pop()!;

        if (!primarySort) {
          nextCursor = { id: last.id, order: last.order };
        } else {
          const cells = (last.cells ?? {}) as Record<string, unknown>;
          const v = cells[primarySort.columnId];
          nextCursor = {
            id: last.id,
            sortValue: v === undefined || v === "" ? null : (v as any),
          };
        }
      }

      return { rows, nextCursor };
    }),

  count: protectedProcedure
    .input(
      z.object({
        tableId: cuid,
        search: z.string().max(200).optional().nullable(),
        filters: filtersSchema.optional(),
        viewId: cuid.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { userId: ctx.dbUser.id } },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND" });

      const columns = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
        select: { id: true, type: true },
      });
      const columnTypes = new Map(columns.map((c) => [c.id, c.type]));
      const searchableColumnIds = columns.map((c) => c.id);

      let mergedSearch = input.search ?? null;
      let mergedFilters: Filters = input.filters ?? {
        conjunction: "and",
        conditions: [],
      };

      if (input.viewId) {
        const view = await ctx.db.view.findFirst({
          where: { id: input.viewId, table: { base: { userId: ctx.dbUser.id } } },
          select: { config: true },
        });
        if (view) {
          const parsed = z
            .object({
              search: z.string().max(200).nullable().optional(),
              filters: filtersSchema.optional(),
            })
            .safeParse(view.config);

          if (parsed.success) {
            mergedSearch = parsed.data.search ?? mergedSearch;
            mergedFilters = parsed.data.filters ?? mergedFilters;
          }
        }
      }

      const searchSQL = buildSearchSQL(mergedSearch, searchableColumnIds);
      const filterSQL = buildFilterSQL(mergedFilters, columnTypes);

      const result = await ctx.db.$queryRaw<
        Array<{ count: bigint }>
      >(Prisma.sql`
        SELECT COUNT(*)::bigint as count
        FROM "Row"
        WHERE "tableId" = ${input.tableId}
          AND (${filterSQL})
          AND (${searchSQL})
      `);

      return { count: Number(result[0]?.count ?? 0) };
    }),

  addRow: protectedProcedure
    .input(z.object({ tableId: cuid }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { userId: ctx.dbUser.id } },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND" });

      const maxOrder = await ctx.db.row.aggregate({
        where: { tableId: input.tableId },
        _max: { order: true },
      });

      return ctx.db.row.create({
        data: {
          tableId: input.tableId,
          order: (maxOrder._max.order ?? 0) + 1,
          cells: {},
        },
      });
    }),

  updateCell: protectedProcedure
    .input(
      z.object({
        rowId: cuid,
        columnId: cuid,
        value: z.union([z.string(), z.number(), z.null()]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.row.findFirst({
        where: { id: input.rowId, table: { base: { userId: ctx.dbUser.id } } },
        select: { id: true, tableId: true, cells: true },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const column = await ctx.db.column.findFirst({
        where: { id: input.columnId, tableId: row.tableId },
        select: { id: true, type: true },
      });
      if (!column) throw new TRPCError({ code: "NOT_FOUND" });

      let nextValue: string | number | null = input.value;
      if (column.type === "NUMBER") {
        if (input.value === null || input.value === "") {
          nextValue = null;
        } else if (typeof input.value === "string") {
          const n = Number(input.value);
          nextValue = Number.isFinite(n) ? n : null;
        }
      } else {
        nextValue = input.value === null ? null : String(input.value);
      }

      const cells = (row.cells ?? {}) as Record<string, unknown>;
      const nextCells = { ...cells, [input.columnId]: nextValue };

      return ctx.db.row.update({
        where: { id: input.rowId },
        data: { cells: nextCells as Prisma.InputJsonValue },
      });
    }),

  generate100k: protectedProcedure
    .input(z.object({ tableId: cuid }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { userId: ctx.dbUser.id } },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND" });

      const columns = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
        select: { id: true, type: true },
      });

      const maxOrder = await ctx.db.row.aggregate({
        where: { tableId: input.tableId },
        _max: { order: true },
      });

      let order = (maxOrder._max.order ?? 0) + 1;
      const TOTAL = 100_000;
      const BATCH = 1_000;

      for (let offset = 0; offset < TOTAL; offset += BATCH) {
        const batch = Array.from({ length: BATCH }, () => {
          const cells: Record<string, unknown> = {};
          for (const col of columns) {
            if (col.type === "NUMBER") {
              cells[col.id] = faker.number.int({ min: 0, max: 1_000_000 });
            } else {
              cells[col.id] = faker.lorem.words({ min: 1, max: 4 });
            }
          }

          return {
            tableId: input.tableId,
            order: order++,
            cells: cells as Prisma.InputJsonValue,
          };
        });

        await ctx.db.row.createMany({ data: batch });
      }

      return { success: true, count: TOTAL };
    }),
});
