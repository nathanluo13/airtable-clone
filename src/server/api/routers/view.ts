import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const cuid = z.string().cuid();

const filterOperatorSchema = z.enum([
  "contains",
  "notContains",
  "equals",
  "isEmpty",
  "isNotEmpty",
  "gt",
  "lt",
]);

const viewConfigSchema = z.object({
  search: z.string().max(200).nullable().optional(),
  filters: z
    .object({
      conjunction: z.enum(["and", "or"]).default("and"),
      conditions: z
        .array(
          z.object({
            columnId: cuid,
            operator: filterOperatorSchema,
            value: z.union([z.string(), z.number(), z.null()]).optional(),
          })
        )
        .default([]),
    })
    .optional(),
  sorts: z
    .array(
      z.object({
        columnId: cuid,
        direction: z.enum(["asc", "desc"]),
      })
    )
    .optional(),
  columnVisibility: z.record(z.boolean()).optional(),
  rowHeight: z.enum(["short", "medium", "tall", "extra_tall"]).optional(),
});

export const viewRouter = createTRPCRouter({
  listByTable: protectedProcedure
    .input(z.object({ tableId: cuid }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { userId: ctx.dbUser.id } },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.view.findMany({
        where: { tableId: input.tableId },
        orderBy: { createdAt: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({ tableId: cuid, name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { userId: ctx.dbUser.id } },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND" });

      const columns = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
        select: { id: true },
      });

      const config = {
        search: null,
        filters: { conjunction: "and", conditions: [] },
        sorts: [],
        columnVisibility: Object.fromEntries(columns.map((c) => [c.id, true])),
        rowHeight: "short",
      };

      return ctx.db.view.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          isDefault: false,
          config,
        },
      });
    }),

  rename: protectedProcedure
    .input(z.object({ viewId: cuid, name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findFirst({
        where: { id: input.viewId, table: { base: { userId: ctx.dbUser.id } } },
        select: { id: true },
      });
      if (!view) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.view.update({
        where: { id: input.viewId },
        data: { name: input.name },
      });
    }),

  updateConfig: protectedProcedure
    .input(z.object({ viewId: cuid, patch: viewConfigSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findFirst({
        where: { id: input.viewId, table: { base: { userId: ctx.dbUser.id } } },
        select: { id: true, config: true },
      });
      if (!view) throw new TRPCError({ code: "NOT_FOUND" });

      const current = (view.config ?? {}) as Record<string, unknown>;
      const next = { ...current, ...input.patch };

      return ctx.db.view.update({
        where: { id: input.viewId },
        data: { config: next },
      });
    }),

  setDefault: protectedProcedure
    .input(z.object({ viewId: cuid }))
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findFirst({
        where: { id: input.viewId, table: { base: { userId: ctx.dbUser.id } } },
        select: { id: true, tableId: true },
      });
      if (!view) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.$transaction([
        ctx.db.view.updateMany({
          where: { tableId: view.tableId },
          data: { isDefault: false },
        }),
        ctx.db.view.update({
          where: { id: view.id },
          data: { isDefault: true },
        }),
      ]);

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ viewId: cuid }))
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findFirst({
        where: { id: input.viewId, table: { base: { userId: ctx.dbUser.id } } },
        select: { id: true, isDefault: true },
      });
      if (!view) throw new TRPCError({ code: "NOT_FOUND" });

      if (view.isDefault) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete the default view",
        });
      }

      await ctx.db.view.delete({ where: { id: input.viewId } });
      return { success: true };
    }),
});
