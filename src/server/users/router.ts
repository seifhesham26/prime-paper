import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, devProcedure } from "../trpc";
import { eq, desc } from "drizzle-orm";
import { resetRequests, user } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";

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

  /**
   * Dev only — create an account with an explicit role.
   *
   * This runs server-side rather than through authClient.admin.createUser in
   * the browser, so the role is set by code that has already authorised the
   * caller, and a failure surfaces as a real error instead of being swallowed.
   */
  invite: devProcedure
    .input(
      z.object({
        name: z.string().trim().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(["admin", "user"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase();

      const [existing] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with that email already exists.",
        });
      }

      const created = await auth.api.createUser({
        body: {
          name: input.name,
          email,
          password: input.password,
          role: input.role,
        },
        headers: ctx.headers,
      });

      // Belt and braces: assert the stored role rather than trusting that no
      // hook or plugin rewrote it on the way in.
      await db
        .update(user)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(user.id, created.user.id));

      return { id: created.user.id };
    }),

  // Dev only — view pending reset tickets
  getPendingResets: devProcedure.query(async () => {
    return db.query.resetRequests.findMany({
      where: eq(resetRequests.status, "pending"),
      orderBy: [desc(resetRequests.createdAt)],
    });
  }),

  // Dev only — mark a reset ticket as resolved
  resolveReset: devProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db
        .update(resetRequests)
        .set({ status: "resolved", updatedAt: new Date() })
        .where(eq(resetRequests.id, input.id));

      return { success: true };
    }),

  // Dev only — look up a single user ID by email
  getUserIdByEmail: devProcedure
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
