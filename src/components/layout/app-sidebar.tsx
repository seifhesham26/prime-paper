"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  LayoutDashboard,
  Package,
  Factory,
  Building2,
  Truck,
  Settings,
  ScrollText,
  UserPlus,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth-client";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" as const },
  { href: "/raw-materials", icon: Package, labelKey: "rawMaterials" as const },
  { href: "/products", icon: Factory, labelKey: "products" as const },
  { href: "/companies", icon: Building2, labelKey: "companies" as const },
  { href: "/deliveries", icon: Truck, labelKey: "deliveries" as const },
];

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const locale = useLocale();
  const { data: session } = useSession();
  const side = locale === "ar" ? "right" : "left";
  const isDev = session?.user?.role === "dev";

  return (
    <Sidebar side={side} collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ScrollText className="h-5 w-5" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h1 className="text-base font-bold leading-tight">
              {t("brandName")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("brandSub")}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                // `/raw-materials/abc` must keep the Raw Materials item lit.
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {isDev && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/invite"}>
                <Link href="/invite">
                  <UserPlus className="h-4 w-4" />
                  <span>{t("invite")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/settings"}>
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>{t("settings")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
