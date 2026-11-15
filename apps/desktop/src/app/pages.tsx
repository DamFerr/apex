import { Chip } from "../components/ui";
import { NAV } from "../lib/nav";
import { useUi, type Theme } from "../lib/store";
import { useLocation } from "react-router-dom";

const Title = ({ children, sub }: { children: string; sub?: string }) => (
  <div className="mb-6"><h1 className="font-display text-3xl font-semibold tracking-tight">{children}</h1>
    {sub && <p className="text-sm text-muted mt-1">{sub}</p>}</div>
);

export function ComingSoon() {
  const { pathname } = useLocation();
  const item = NAV.find((n) => n.path === pathname);
  return (<>
    <Title sub={item && item.phase > 1 ? `Planned for Phase ${item.phase}.` : "Built in an upcoming step of Phase 1."}>{item?.label ?? "Page"}</Title>
    <div className="glass rounded-lg p-10 text-sm text-muted max-w-xl">This screen isn’t built yet. Navigation, transitions and the design system are ready for it.</div>
  </>);
}
