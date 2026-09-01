export type SettingDefinition =
  | {
      key: string;
      type: "int";
      category: "operational" | "dashboard" | "ui";
      min: number;
      max: number;
      default: number;
      label: string;
      labelAr: string;
    }
  | {
      key: string;
      type: "boolean";
      category: "operational" | "dashboard" | "ui";
      default: "true" | "false";
      label: string;
      labelAr: string;
    };

/**
 * Every numeric setting the application actually reads.
 *
 * A key that is not declared here is editable but inert — which is what the
 * Settings screen used to be in its entirety. Add the key here first, then
 * consume it via getSettingsMap().
 */
export const SETTINGS_REGISTRY: SettingDefinition[] = [
  {
    key: "page_size_default",
    type: "int",
    category: "operational",
    min: 5,
    max: 200,
    default: 50,
    label: "Rows per page",
    labelAr: "عدد الصفوف في الصفحة",
  },
  {
    key: "dropdown_list_limit",
    type: "int",
    category: "operational",
    min: 10,
    max: 2000,
    default: 1000,
    label: "Dropdown list limit",
    labelAr: "حد عناصر القائمة المنسدلة",
  },
  {
    key: "dashboard_recent_deliveries",
    type: "int",
    category: "dashboard",
    min: 1,
    max: 50,
    default: 5,
    label: "Recent deliveries shown",
    labelAr: "عدد التسليمات الأخيرة المعروضة",
  },
  {
    key: "dashboard_top_unpaid",
    type: "int",
    category: "dashboard",
    min: 1,
    max: 50,
    default: 5,
    label: "Top unpaid companies shown",
    labelAr: "عدد الشركات المدينة المعروضة",
  },
  {
    key: "dashboard_chart_months",
    type: "int",
    category: "dashboard",
    min: 3,
    max: 24,
    default: 6,
    label: "Months in the revenue chart",
    labelAr: "عدد الأشهر في الرسم البياني",
  },
  {
    key: "allow_public_signup",
    type: "boolean",
    category: "operational",
    default: "false",
    label: "Allow public registration",
    labelAr: "السماح بالتسجيل العام",
  },
];

export const SETTINGS_BY_KEY = new Map(SETTINGS_REGISTRY.map((s) => [s.key, s]));

export type SettingsMap = {
  pageSizeDefault: number;
  dropdownListLimit: number;
  dashboardRecentDeliveries: number;
  dashboardTopUnpaid: number;
  dashboardChartMonths: number;
};
