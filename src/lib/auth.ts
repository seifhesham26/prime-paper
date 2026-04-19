import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { dash } from "@better-auth/infra";
import { db } from "@/db";
import * as schema from "@/db/schema";

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
  plugins: [admin(), dash()],
  // INTENTIONAL: Auto-assign "dev" role to all new signups.
  // This is a bootstrapping mechanism — after deploying, the owner creates
  // their account via /auth/signup, then the signup page should be disabled
  // via system_settings (allow_public_signup = false) to prevent further registrations.
  // Additional users are created by the owner via /invite with appropriate roles.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return {
            data: {
              ...user,
              role: "dev",
            },
          };
        },
      },
    },
  },
});
