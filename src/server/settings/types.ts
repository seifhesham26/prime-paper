import { z } from "zod";

// ─── System Settings ─────────────────────────────────────
export const UpdateSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export type SystemSetting = {
  key: string;
  value: string;
  category: string;
  updatedAt: Date;
};

// ─── Dashboard Cards ─────────────────────────────────────
export const CreateDashboardCardSchema = z.object({
  title: z.string().min(1),
  titleAr: z.string().min(1),
  equation: z.string().min(1),
  unit: z.string().min(1),
  icon: z.string().min(1),
  gradient: z.string().min(1),
  sortOrder: z.number().int().default(0),
  visible: z.boolean().default(true),
});

export const UpdateDashboardCardSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  titleAr: z.string().min(1).optional(),
  equation: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  icon: z.string().min(1).optional(),
  gradient: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  visible: z.boolean().optional(),
});

export const ReorderCardsSchema = z.object({
  cards: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int(),
  })),
});

export type DashboardCard = {
  id: string;
  title: string;
  titleAr: string;
  equation: string;
  unit: string;
  icon: string;
  gradient: string;
  sortOrder: number;
  visible: boolean;
  createdAt: Date;
  updatedAt: Date;
};
