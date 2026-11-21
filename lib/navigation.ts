import type { IconName } from "@/components/icon";

export type ModuleDefinition = {
  slug: string;
  label: string;
  icon: IconName;
  description: string;
  detail: string;
};

export const modules: ModuleDefinition[] = [
  {
    slug: "area-managers",
    label: "Area Manager Dashboard",
    icon: "stores",
    description: "See which stores need attention and understand the likely cause.",
    detail: "Priorities will be compared with relevant peers and ranked by potential rupees at stake, with a maximum of five issues each week.",
  },
  {
    slug: "stores",
    label: "Store Performance",
    icon: "trend",
    description: "Review conversion, basket size, and customer repeat behaviour by store.",
    detail: "Store comparisons will account for city, state, and tier so each team is measured against a fair peer group.",
  },
  {
    slug: "salespeople",
    label: "Salesperson Performance",
    icon: "people",
    description: "Help each salesperson understand their performance and next opportunity.",
    detail: "Coaching will compare people with relevant peers and give each salesperson one specific action of no more than 60 words.",
  },
  {
    slug: "recommendations",
    label: "Action Recommendations",
    icon: "spark",
    description: "Turn verified performance signals into actions a store team can take today.",
    detail: "Every recommendation will name the behaviour, person responsible, and timing. Business calculations remain in verified application logic.",
  },
  {
    slug: "stock",
    label: "Stock Insights",
    icon: "stock",
    description: "Find stock constraints that may be limiting a store’s ability to sell.",
    detail: "Insights will use store stock, warehouse inbound, days in stock, and display rules from the source workbook.",
  },
  {
    slug: "retention",
    label: "Customer Retention",
    icon: "repeat",
    description: "Understand whether customers return for another bill 30 or more days later.",
    detail: "Retention analysis will use the workbook’s consistent customer IDs and first-bill dates; no customer identity will be inferred.",
  },
  {
    slug: "weekly-review",
    label: "Weekly Impact Review",
    icon: "calendar",
    description: "Check whether completed recommendations moved the intended measure.",
    detail: "Follow-up will compare outcomes over time and distinguish store-specific movement from regional or seasonal changes.",
  },
  {
    slug: "data-quality",
    label: "Data Quality & Monitoring",
    icon: "shield",
    description: "Catch incomplete or inconsistent source records before they affect decisions.",
    detail: "Validation will check IDs, dates, joins, missing values, and business-rule consistency before metrics are calculated.",
  },
];

export const moduleBySlug = new Map(modules.map((module) => [module.slug, module]));
