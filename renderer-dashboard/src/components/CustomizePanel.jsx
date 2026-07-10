import InspectorPanel from './Customize/Inspector/InspectorPanel.jsx';

// CustomizePanel used to be a ~1200-line file containing every control for
// every object in one giant scrolling form. It's now a thin mount point for
// the Inspector (see components/Customize/), which shows only the settings
// relevant to whatever object the user has selected.
export default function CustomizePanel({ api, config, slotStyleConfig, animationConfig }) {
  return (
    <InspectorPanel api={api} config={config} slotStyleConfig={slotStyleConfig} animationConfig={animationConfig} />
  );
}
