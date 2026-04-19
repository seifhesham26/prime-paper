import { z } from "zod";
import { createTRPCRouter, publicProcedure, writerProcedure } from "../trpc";
import { eq, desc } from "drizzle-orm";
import { resetRequests, user } from "@/db/schema";
import { db } from "@/db";

export const usersRouter = createTRPCRouter({
  // Public — anyone can submit a password reset request (even unauthenticated)
  requestReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      await db.insert(resetRequests).values({
        email: input.email.toLowerCase(),
        status: "pending",
      });
      return { success: true };
    }),

  // Admin only — view pending reset tickets
  getPendingResets: writerProcedure.query(async () => {
    return db.query.resetRequests.findMany({
      where: eq(resetRequests.status, "pending"),
      orderBy: [desc(resetRequests.createdAt)],
    });
  }),

  // Admin only — mark a reset ticket as resolved
  resolveReset: writerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db
        .update(resetRequests)
        .set({ status: "resolved", updatedAt: new Date() })
        .where(eq(resetRequests.id, input.id));

      return { success: true };
    }),

  // Admin only — look up a single user ID by email (replaces client-side listUsers)
  getUserIdByEmail: writerProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const result = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, input.email.toLowerCase()))
        .limit(1);
      return result[0] ?? null;
    }),
});
