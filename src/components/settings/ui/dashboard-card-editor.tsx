"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { api } from "@/trpc/react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  LayoutDashboard,
  GripVertical,
  Variable,
} from "lucide-react";

const ICON_OPTIONS = [
  "Package",
  "Factory",
  "Truck",
  "CreditCard",
  "BarChart3",
  "TrendingUp",
  "DollarSign",
  "Users",
  "Hash",
];

const GRADIENT_OPTIONS = [
  { value: "from-blue-500 to-blue-600", label: "Blue", color: "#3b82f6" },
  {
    value: "from-emerald-500 to-emerald-600",
    label: "Emerald",
    color: "#10b981",
  },
  { value: "from-amber-500 to-amber-600", label: "Amber", color: "#f59e0b" },
  { value: "from-rose-500 to-rose-600", label: "Rose", color: "#f43f5e" },
  { value: "from-purple-500 to-purple-600", label: "Purple", color: "#a855f7" },
  { value: "from-cyan-500 to-cyan-600", label: "Cyan", color: "#06b6d4" },
  { value: "from-orange-500 to-orange-600", label: "Orange", color: "#f97316" },
  { value: "from-indigo-500 to-indigo-600", label: "Indigo", color: "#6366f1" },
];

const UNIT_OPTIONS = ["tons", "rolls", "egp", "kg", "count"];

type CardForm = {
  title: string;
  titleAr: string;
  equation: string;
  unit: string;
  icon: string;
  gradient: string;
  visible: boolean;
};

const emptyForm: CardForm = {
  title: "",
  titleAr: "",
  equation: "",
  unit: "count",
  icon: "Package",
  gradient: "from-blue-500 to-blue-600",
  visible: true,
};

export function DashboardCardEditor() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const isArabic = locale === "ar";
  const confirm = useConfirm();

  const { data: cards, isLoading } = api.settings.getCards.useQuery();
  const { data: variables } = api.analytics.getEquationVariables.useQuery();
  const utils = api.useUtils();

  const createMutation = api.settings.createCard.useMutation({
    onSuccess: () => {
      utils.settings.getCards.invalidate();
      utils.analytics.evaluateCards.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  // Shared by the create/edit dialog's submit AND by the silent
  // toggle-visibility control. The dialog path shows its own success toast
  // explicitly in handleSubmit; toggling visibility is already visible in
  // the row (it greys out), so it stays quiet on success and only surfaces
  // an error toast if the write fails.
  const updateMutation = api.settings.updateCard.useMutation({
    onSuccess: () => {
      utils.settings.getCards.invalidate();
      utils.analytics.evaluateCards.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = api.settings.deleteCard.useMutation({
    onSuccess: () => {
      toast.success(tc("deleted"));
      utils.settings.getCards.invalidate();
      utils.analytics.evaluateCards.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  // Reordering is already visible as the row moving; a toast on every
  // up/down click would be noise, especially when clicked repeatedly.
  const reorderMutation = api.settings.reorderCards.useMutation({
    onSuccess: () => {
      utils.settings.getCards.invalidate();
      utils.analytics.evaluateCards.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CardForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (card: NonNullable<typeof cards>[number]) => {
    setEditingId(card.id);
    setForm({
      title: card.title,
      titleAr: card.titleAr,
      equation: card.equation,
      unit: card.unit,
      icon: card.icon,
      gradient: card.gradient,
      visible: card.visible,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...form });
      } else {
        await createMutation.mutateAsync({
          ...form,
          sortOrder: cards?.length || 0,
        });
      }
      toast.success(tc("saved"));
      setDialogOpen(false);
    } catch {
      // Rejected by equation validation; onError has already reported it and
      // the dialog stays open so the equation can be corrected.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (card: NonNullable<typeof cards>[number]) => {
    const ok = await confirm({
      title: t("confirmDeleteCard"),
      description: `${isArabic ? card.titleAr : card.title} — ${tc("confirmDeleteDescription")}`,
      confirmLabel: tc("delete"),
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(card.id);
    try {
      await deleteMutation.mutateAsync({ id: card.id });
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleVisibility = async (
    card: NonNullable<typeof cards>[number],
  ) => {
    await updateMutation.mutateAsync({
      id: card.id,
      visible: !card.visible,
    });
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (!cards) return;
    const newCards = [...cards];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newCards.length) return;

    // Swap sort orders
    const reordered = newCards.map((c, i) => {
      if (i === index)
        return { id: c.id, sortOrder: newCards[swapIndex].sortOrder };
      if (i === swapIndex)
        return { id: c.id, sortOrder: newCards[index].sortOrder };
      return { id: c.id, sortOrder: c.sortOrder };
    });

    await reorderMutation.mutateAsync({ cards: reordered });
  };

  const endsWithOperator = (eq: string) => /[+\-*/]\s*$/.test(eq);

  // Appending " + token" after the user already chose an operator produced
  // "X * + Y", which is not a valid equation.
  const insertVariable = (token: string) => {
    setForm((prev) => {
      if (!prev.equation.trim()) return { ...prev, equation: token };
      if (endsWithOperator(prev.equation))
        return { ...prev, equation: `${prev.equation}${token}` };
      return { ...prev, equation: `${prev.equation} + ${token}` };
    });
  };

  const insertOperator = (op: string) => {
    setForm((prev) => {
      if (!prev.equation.trim()) return prev;
      const base = endsWithOperator(prev.equation)
        ? prev.equation.replace(/[+\-*/]\s*$/, "")
        : prev.equation;
      return { ...prev, equation: `${base.trimEnd()} ${op} ` };
    });
  };

  if (isLoading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
            {t("dashboardCards")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("dashboardCardsDesc")}
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          {t("addCard")}
        </Button>
      </div>

      {!cards?.length ? (
        <Card className="border-dashed shadow-none bg-transparent">
          <CardHeader className="sr-only">
            <CardTitle>{t("noCards")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <LayoutDashboard className="h-8 w-8 mb-4 opacity-50" />
            <p>{t("noCards")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {cards.map((card, index) => (
            <Card
              key={card.id}
              className={`shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${
                !card.visible ? "opacity-60" : ""
              }`}
            >
              <CardHeader className="p-0">
                <CardTitle className="sr-only">{isArabic ? card.titleAr : card.title}</CardTitle>
              </CardHeader>
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Grip handle + color indicator */}
                <div className="flex items-center gap-2 shrink-0">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                  <div
                    className="w-3 h-8 rounded-full"
                    style={{
                      background:
                        GRADIENT_OPTIONS.find((g) => g.value === card.gradient)
                          ?.color || "#3b82f6",
                    }}
                  />
                </div>

                {/* Card info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {isArabic ? card.titleAr : card.title}
                    </span>
                    {!card.visible && (
                      <Badge variant="secondary" className="text-xs">
                        <EyeOff className="h-3 w-3 mr-1" />
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                    {card.equation}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={index === 0}
                    onClick={() => handleMove(index, "up")}
                    title={t("moveUp")}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={index === cards.length - 1}
                    onClick={() => handleMove(index, "down")}
                    title={t("moveDown")}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleToggleVisibility(card)}
                    title={t("cardVisible")}
                  >
                    {card.visible ? (
                      <Eye className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openEdit(card)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(card)}
                    disabled={deletingId === card.id}
                  >
                    {deletingId === card.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("editCard") : t("addCard")}
            </DialogTitle>
            <DialogDescription>{t("dashboardCardsDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title EN */}
            <div className="space-y-1.5">
              <Label className="text-sm">{t("cardTitle")}</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Total Raw Materials"
                className="bg-muted/50"
              />
            </div>

            {/* Title AR */}
            <div className="space-y-1.5">
              <Label className="text-sm">{t("cardTitleAr")}</Label>
              <Input
                value={form.titleAr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, titleAr: e.target.value }))
                }
                placeholder="مثال: إجمالي المواد الخام"
                dir="rtl"
                className="bg-muted/50"
              />
            </div>

            {/* Equation */}
            <div className="space-y-1.5">
              <Label className="text-sm">{t("cardEquation")}</Label>
              <Input
                value={form.equation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, equation: e.target.value }))
                }
                placeholder="SUM(raw_materials.weight_tons)"
                dir="ltr"
                className="bg-muted/50 font-mono text-sm"
              />
              {/* Variable Inserter */}
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Variable className="h-3.5 w-3.5" />
                  {t("addVariable")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variables?.map((v) => (
                    <Button
                      key={v.token}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs font-normal"
                      onClick={() => insertVariable(v.token)}
                    >
                      {isArabic ? v.labelAr : v.label}
                    </Button>
                  ))}
                </div>
                {/* Operators */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  {t("operators")}
                </div>
                <div className="flex gap-1.5">
                  {["+", "-", "*", "/"].map((op) => (
                    <Button
                      key={op}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 w-8 text-xs font-mono"
                      onClick={() => insertOperator(op)}
                    >
                      {op}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Unit + Icon + Color row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">{t("cardUnit")}</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}
                >
                  <SelectTrigger className="bg-muted/50 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{t("cardIcon")}</Label>
                <Select
                  value={form.icon}
                  onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}
                >
                  <SelectTrigger className="bg-muted/50 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{t("cardGradient")}</Label>
                <Select
                  value={form.gradient}
                  onValueChange={(v) => setForm((f) => ({ ...f, gradient: v }))}
                >
                  <SelectTrigger className="bg-muted/50 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADIENT_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ background: g.color }}
                          />
                          {g.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                saving || !form.title || !form.titleAr || !form.equation
              }
              className="gap-1.5"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? t("save") : t("addCard")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
