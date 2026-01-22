import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const cuid = z.string().cuid();

export const baseRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      where: { userId: ctx.dbUser.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        createdAt: true,
        updatedAt: true,
        tables: {
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true },
        },
      },
    });
  }),

  get: protectedProcedure
    .input(z.object({ baseId: cuid }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, userId: ctx.dbUser.id },
        include: {
          tables: {
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true },
          },
        },
      });

      if (!base) throw new TRPCError({ code: "NOT_FOUND" });
      return base;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.base.create({
        data: {
          name: input.name,
          icon: "GearsBaseIcon",
          color: "var(--palette-green)",
          userId: ctx.dbUser.id,
        },
      });
    }),

  rename: protectedProcedure
    .input(z.object({ baseId: cuid, name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, userId: ctx.dbUser.id },
        select: { id: true },
      });
      if (!base) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.base.update({
        where: { id: input.baseId },
        data: { name: input.name },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ baseId: cuid }))
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, userId: ctx.dbUser.id },
        select: { id: true },
      });
      if (!base) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.base.delete({ where: { id: input.baseId } });
      return { success: true };
    }),
});
