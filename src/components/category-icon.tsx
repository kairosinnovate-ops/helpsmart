import { Sparkles, Home, Wrench, Zap, Hammer, HeartHandshake, Baby, PaintRoller, Ruler, Refrigerator, GraduationCap, Building2, BriefcaseBusiness, Circle, LayoutGrid } from "lucide-react";

const ICONS = { Sparkles, Home, Wrench, Zap, Hammer, HeartHandshake, Baby, PaintRoller, Ruler, Refrigerator, GraduationCap, Building2, BriefcaseBusiness, Circle, LayoutGrid };

/** Consistent service category iconography (Lucide). Admins choose from this set. */
export function CategoryIcon({ name, className = "size-6" }: { name: string; className?: string }) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Circle;
  return <Icon className={className} aria-hidden />;
}

export const CATEGORY_ICON_NAMES = Object.keys(ICONS);
