import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";
import { dash } from "@better-auth/infra";
import { db } from "@/db";
import * as schema from "@/db/schema";

// ─── Access Control ──────────────────────────────────────
// Better Auth only treats roles listed in `adminRoles` as administrators,
// and it rejects any adminRole that is not also declared here. Without
// this block, `dev` is not an admin role and every admin API call made by
// a dev account fails — which is why invites silently created nobody.
const ac = createAccessControl(defaultStatements);

const roles = {
  admin: adminAc,
  user: userAc,
  /** Full administrative capability, including over other admins. */
  dev: ac.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "impersonate-admins",
      "delete",
      "set-password",
      "get",
      "update",
    ],
    session: ["list", "revoke", "delete"],
  }),
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({ ac, roles, adminRoles: ["admin", "dev"], defaultRole: "user" }),
    dash(),
  ],
  /**
   * Enforce the public-signup toggle at the API, not just in the UI. Hiding
   * /auth/signup left POST /api/auth/sign-up/email wide open, so anyone
   * could still register themselves an account.
   *
   * This is a route middleware rather than a database hook on purpose:
   * database hooks are chained, and the admin plugin's hook runs first and
   * fills in a default role — so a hook cannot tell a self-signup from an
   * invite. The request path can.
   */
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;

      const [existing] = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
      // The very first account must be allowed through to bootstrap the system.
      if (!existing) return;

      const [setting] = await db
        .select({ value: schema.systemSettings.value })
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, "allow_public_signup"))
        .limit(1);

      if (setting?.value !== "true") {
        throw new APIError("FORBIDDEN", { message: "Public registration is disabled." });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        // Bootstrap only: the very first account to exist becomes "dev" so
        // there is someone who can administer the system. Every later account
        // keeps whatever role its creator specified — users.invite sets that
        // explicitly, and the admin plugin fills in "user" otherwise.
        //
        // This deliberately does NOT force a role on later users. Doing so is
        // what made the /invite role selector a no-op and handed full write
        // access to everyone who was invited.
        before: async (user) => {
          const [existing] = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .limit(1);

          if (existing) return { data: user };
          return { data: { ...user, role: "dev" } };
        },
      },
    },
  },
});
