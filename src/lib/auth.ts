import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
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
  databaseHooks: {
    user: {
      create: {
        // Bootstrap only: the very first account to exist becomes "dev" so
        // there is someone who can administer the system. Every later account
        // keeps whatever role its creator specified — users.invite sets that
        // explicitly, and public signups fall through to the "user" default.
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
