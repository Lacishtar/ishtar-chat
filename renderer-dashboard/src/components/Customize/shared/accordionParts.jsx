
// AccordionSection lays its children out in a 2-column grid (right for the
export function AccordionBody({ children }) {
  return <div className="col-span-2 flex flex-col gap-3 min-w-0">{children}</div>;
}

// Inline label + hairline rule, used to break up an AccordionBody into
// labeled sub-groups (e.g. "Màu sắc", "Badge & chữ") without opening a
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
