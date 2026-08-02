// Small presentational pieces that pair with AccordionSection
// (Customize/Inspector/AccordionSection.jsx) but aren't part of its own
// contract. Originally lived inside RoleStylesPanel.jsx and were imported
// from there by FanServicePanel — moved here so shared chrome lives in one
// place (Customize/shared/) instead of one panel reaching into another's
// file. RoleStylesPanel and FanServicePanel both import from here now;
// MembershipMilestonePanel.jsx picks these up too via RoleStylesPanel's
// existing re-export (kept for backward compatibility, see bottom of that
// file) so nothing downstream needed to change.

/** AccordionSection lays its children out in a 2-column grid (right for the
    Customize Inspector's small paired controls). Roles/Fan Service's
    controls skew wide (gradient-capable color pickers, sliders, badge
    grids), so each group's body is handed a single col-span-2 child that
    switches back to a plain stacked column — reusing the accordion's chrome
    without forcing that content into a layout it wasn't designed for. */
export function AccordionBody({ children }) {
  return <div className="col-span-2 flex flex-col gap-3 min-w-0">{children}</div>;
}

/** Inline label + hairline rule, used to break up an AccordionBody into
    labeled sub-groups (e.g. "Màu sắc", "Badge & chữ") without opening a
    nested accordion. */
export function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-inkMuted/70">
        {label}
      </span>
      <div className="flex-1 h-px bg-line/60" />
    </div>
  );
}
