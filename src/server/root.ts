import { createTRPCRouter } from "./trpc";
import { analyticsRouter } from "./analytics/router";
import { companiesRouter } from "./companies/router";
import { deliveriesRouter } from "./deliveries/router";
import { productsRouter } from "./products/router";
import { rawMaterialsRouter } from "./raw-materials/router";
import { usersRouter } from "./users/router";
import { settingsRouter } from "./settings/router";

export const appRouter = createTRPCRouter({
  analytics: analyticsRouter,
  companies: companiesRouter,
  deliveries: deliveriesRouter,
  products: productsRouter,
  rawMaterials: rawMaterialsRouter,
  users: usersRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
