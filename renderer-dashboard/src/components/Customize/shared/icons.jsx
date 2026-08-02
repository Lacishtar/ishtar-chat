// Only icons that were found byte-identical (same path data) copy-pasted
// across multiple files are collected here — not a general-purpose icon
// library. Extracting a one-off icon "just in case" would be speculative
// abstraction with no evidence behind it, so those stay inline in whichever
// panel uses them (e.g. the trash/move/duplicate icons in
// DecorationsPanel.jsx are each used once and are left as-is).
//
// className is required at the call site (size/color/rotation all vary by
// context) — these components only own the shape.

/** Disclosure chevron for collapsible sections. Was duplicated identically
    in AccordionSection.jsx, DecorationsPanel.jsx (x2), ThemeLibraryPanel.jsx,
    and Customize/Themes/ThemeSection.jsx — same path, only the wrapping
    size/rotation class differed. */
export function ChevronDownIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Magnifying-glass search icon. Was duplicated identically in
    Customize/Inspector/SearchBar.jsx, ThemeLibraryPanel.jsx, and
    Customize/Themes/ThemeSection.jsx. */
export function SearchIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13L17 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
