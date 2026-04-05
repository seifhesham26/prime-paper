import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { eq, desc } from "drizzle-orm";
import { resetRequests } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { TRPCError } from "@trpc/server";

export const usersRouter = createTRPCRouter({
  requestReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      // Create a pending request
      await db.insert(resetRequests).values({
        email: input.email.toLowerCase(),
        status: "pending",
      });
      return { success: true };
    }),

  getPendingResets: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({ headers: ctx.headers });
    if (!session?.user || (session.user.role !== "dev" && session.user.role !== "admin")) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    
    return db.query.resetRequests.findMany({
      where: eq(resetRequests.status, "pending"),
      orderBy: [desc(resetRequests.createdAt)],
    });
  }),

  resolveReset: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session?.user || (session.user.role !== "dev" && session.user.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .update(resetRequests)
        .set({ status: "resolved", updatedAt: new Date() })
        .where(eq(resetRequests.id, input.id));

      return { success: true };
    }),
});
