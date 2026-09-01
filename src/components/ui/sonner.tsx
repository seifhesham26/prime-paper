"use client";

import { useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  const { theme = "system" } = useTheme();
  const locale = useLocale();
  const isRtl = locale === "ar";

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      dir={isRtl ? "rtl" : "ltr"}
      // Toasts follow the reading direction: they settle on the side the
      // eye starts from.
      position={isRtl ? "top-left" : "top-right"}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "bg-popover text-popover-foreground border-border shadow-lg",
        },
      }}
      {...props}
    />
  );
}
