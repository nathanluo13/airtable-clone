import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { Prisma } from "../../../../generated/prisma";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const cuid = z.string().cuid();

export const tableRouter = createTRPCRouter({
  listByBase: protectedProcedure
    .input(z.object({ baseId: cuid }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, userId: ctx.dbUser.id },
        select: { id: true },
      });
      if (!base) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });
    }),

  get: protectedProcedure
    .input(z.object({ tableId: cuid }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: {
          id: input.tableId,
          base: { userId: ctx.dbUser.id },
        },
        include: {
          columns: { orderBy: { order: "asc" } },
          views: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!table) throw new TRPCError({ code: "NOT_FOUND" });
      return table;
    }),

  createWithDefaults: protectedProcedure
    .input(
      z.object({
        baseId: cuid,
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, userId: ctx.dbUser.id },
        select: { id: true },
      });
      if (!base) throw new TRPCError({ code: "NOT_FOUND" });

      const table = await ctx.db.table.create({
        data: {
          baseId: input.baseId,
          name: input.name,
        },
      });

      // Default columns
      await ctx.db.column.createMany({
        data: [
          {
            tableId: table.id,
            name: "Name",
            type: "TEXT",
            isPrimary: true,
            order: 0,
            width: 240,
          },
          {
            tableId: table.id,
            name: "Notes",
            type: "TEXT",
            order: 1,
            width: 320,
          },
          {
            tableId: table.id,
            name: "Value",
            type: "NUMBER",
            order: 2,
            width: 160,
          },
        ],
      });

      const columns = await ctx.db.column.findMany({
        where: { tableId: table.id },
        orderBy: { order: "asc" },
        select: { id: true, type: true, order: true },
      });

      const primaryCol = columns.find((c) => c.order === 0);
      const notesCol = columns.find((c) => c.order === 1);
      const valueCol = columns.find((c) => c.order === 2);

      // Default rows (match Airtable's minimal starter table)
      const DEFAULT_ROWS = 3;
      const rows = Array.from({ length: DEFAULT_ROWS }, (_, i) => ({
        tableId: table.id,
        order: i + 1,
        cells: {} as Prisma.InputJsonValue,
      }));

      await ctx.db.row.createMany({ data: rows });

      // Default view
      const columnVisibility = Object.fromEntries(
        columns.map((c) => [c.id, true])
      );

      await ctx.db.view.create({
        data: {
          tableId: table.id,
          name: "Grid view",
          isDefault: true,
          config: {
            search: null,
            filters: { conjunction: "and", conditions: [] },
            sorts: primaryCol ? [{ columnId: primaryCol.id, direction: "asc" }] : [],
            columnVisibility,
            rowHeight: "short",
          },
        },
      });

      return table;
    }),

  rename: protectedProcedure
    .input(z.object({ tableId: cuid, name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { userId: ctx.dbUser.id } },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.table.update({
        where: { id: input.tableId },
        data: { name: input.name },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ tableId: cuid }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { userId: ctx.dbUser.id } },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.table.delete({ where: { id: input.tableId } });
      return { success: true };
    }),
});
