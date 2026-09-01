import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth.api.getSession({ headers: opts.headers });
  return {
    ...opts,
    session,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ─── Middleware ───────────────────────────────────────────

/** Enforce authenticated session */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, session: ctx.session },
  });
});

/** Enforce dev or admin role (for create/update/delete operations) */
const enforceWriter = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const role = ctx.session.user.role;
  if (role !== "dev" && role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
  }
  return next({
    ctx: { ...ctx, session: ctx.session },
  });
});

/** Enforce the dev role — account administration only */
const enforceDev = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (ctx.session.user.role !== "dev") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Requires the dev role" });
  }
  return next({
    ctx: { ...ctx, session: ctx.session },
  });
});

// ─── Procedures ──────────────────────────────────────────

export const createTRPCRouter = t.router;

/** No auth required — landing page, login, forgot-password */
export const publicProcedure = t.procedure;

/** Any authenticated user can call (read operations) */
export const protectedProcedure = t.procedure.use(enforceAuth);

/** Only dev + admin can call (create/update/delete operations) */
export const writerProcedure = t.procedure.use(enforceWriter);

/** Only dev can call (user administration, password resets) */
export const devProcedure = t.procedure.use(enforceDev);
