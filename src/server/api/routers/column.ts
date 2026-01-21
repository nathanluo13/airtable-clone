import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { Prisma } from "../../../../generated/prisma";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const cuid = z.string().cuid();

export const columnRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ tableId: cuid }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { userId: ctx.dbUser.id } },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.column.findMany({
        where: { tableId: input.tableId },
        orderBy: { order: "asc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        tableId: cuid,
        name: z.string().min(1).max(255),
        type: z.enum(["TEXT", "NUMBER"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.tableId, base: { userId: ctx.dbUser.id } },
        select: { id: true },
      });
      if (!table) throw new TRPCError({ code: "NOT_FOUND" });

      const maxOrder = await ctx.db.column.aggregate({
        where: { tableId: input.tableId },
        _max: { order: true },
      });

      return ctx.db.column.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          type: input.type,
          order: (maxOrder._max.order ?? 0) + 1,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        columnId: cuid,
        name: z.string().min(1).max(255).optional(),
        width: z.number().int().min(80).max(800).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const column = await ctx.db.column.findFirst({
        where: {
          id: input.columnId,
          table: { base: { userId: ctx.dbUser.id } },
        },
        select: { id: true },
      });
      if (!column) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.column.update({
        where: { id: input.columnId },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.width ? { width: input.width } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ columnId: cuid }))
    .mutation(async ({ ctx, input }) => {
      const column = await ctx.db.column.findFirst({
        where: {
          id: input.columnId,
          table: { base: { userId: ctx.dbUser.id } },
        },
        select: { id: true, tableId: true, isPrimary: true },
      });
      if (!column) throw new TRPCError({ code: "NOT_FOUND" });
      if (column.isPrimary) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete the primary field",
        });
      }

      await ctx.db.$executeRaw(
        Prisma.sql`UPDATE "Row" SET cells = cells - ${input.columnId} WHERE "tableId" = ${column.tableId}`
      );

      await ctx.db.column.delete({ where: { id: input.columnId } });
      return { success: true };
    }),
});
