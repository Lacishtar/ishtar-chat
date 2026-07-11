import InspectorPanel from './Customize/Inspector/InspectorPanel.jsx';

// CustomizePanel used to be a ~1200-line file containing every control for
// every object in one giant scrolling form. It's now a thin mount point for
// the Inspector (see components/Customize/), which shows only the settings
// relevant to whatever object the user has selected.
//
// It no longer takes config/slotStyleConfig/animationConfig/api props —
// InspectorPanel (via useCustomizeState) reads and writes the shared editor
// state directly from EditorStateContext, the same buffer LayoutPanel,
// DecorationsPanel, RoleStylesPanel, and CustomPresetsPanel use.
export default function CustomizePanel() {
  return <InspectorPanel />;
}
