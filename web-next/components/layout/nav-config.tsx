import {
  Home,
  History,
  Settings,
  ShieldCheck,
  Sparkles,
  Wand2,
  UserCircle2,
  Mic2,
  ImagePlus,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth/store";

/**
 * Role-based nav map. Per the theme spec, the visual language is the
 * same across roles; the admin area simply extends the navigation.
 */
export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Roles allowed to see this entry. */
  visibleTo: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    labelKey: "nav.home",
    icon: Home,
    visibleTo: ["guest", "user", "admin"],
  },
  {
    href: "/history",
    labelKey: "nav.history",
    icon: History,
    visibleTo: ["user", "admin"],
  },
  {
    href: "/settings",
    labelKey: "nav.settings",
    icon: Settings,
    visibleTo: ["admin"],
  },
  {
    href: "/admin",
    labelKey: "nav.admin",
    icon: ShieldCheck,
    visibleTo: ["admin"],
  },
];

export const PIPELINE_NAV: Array<{
  key: string;
  href: string;
  labelKey: string;
  icon: LucideIcon;
}> = [
  {
    key: "standard",
    href: "/generate/standard",
    labelKey: "pipelines.standard.name",
    icon: Sparkles,
  },
  {
    key: "asset_based",
    href: "/generate/asset-based",
    labelKey: "pipelines.asset_based.name",
    icon: ImagePlus,
  },
  {
    key: "digital_human",
    href: "/generate/digital-human",
    labelKey: "pipelines.digital_human.name",
    icon: UserCircle2,
  },
  {
    key: "i2v",
    href: "/generate/i2v",
    labelKey: "pipelines.i2v.name",
    icon: Wand2,
  },
  {
    key: "action_transfer",
    href: "/generate/action-transfer",
    labelKey: "pipelines.action_transfer.name",
    icon: Mic2,
  },
];

export function visibleNavFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.visibleTo.includes(role));
}
