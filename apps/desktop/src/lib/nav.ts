import { Home, Swords, Shield, BarChart3, User, Radio, LineChart, Trophy, Settings, type LucideIcon } from "lucide-react";
export interface NavItem { path: string; label: string; icon: LucideIcon; phase: 1 | 2 | 3 | 4 }
/** Order follows Section 7 of the plan. phase > 1 renders a "coming soon" page. */
export const NAV: NavItem[] = [
  { path: "/", label: "Home", icon: Home, phase: 1 },
  { path: "/draft", label: "Draft", icon: Swords, phase: 1 },
  { path: "/champions", label: "Champions", icon: Shield, phase: 1 },
  { path: "/tierlist", label: "Tier List", icon: BarChart3, phase: 2 },
  { path: "/profile", label: "Profile", icon: User, phase: 1 },
  { path: "/live", label: "Live Game", icon: Radio, phase: 2 },
  { path: "/analysis", label: "Analysis", icon: LineChart, phase: 3 },
  { path: "/pro", label: "Pro", icon: Trophy, phase: 4 },
];
export const SETTINGS_ITEM: NavItem = { path: "/settings", label: "Settings", icon: Settings, phase: 1 };
