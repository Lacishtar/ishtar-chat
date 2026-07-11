import { Field } from '../shared/fields.jsx';
import ColorPicker from '../shared/ColorPicker.jsx';

export default function BackgroundSection({ rgba, onChange, label = 'Màu nền bubble' }) {
  return (
    // `full`: this ColorPicker allows gradients, whose editor (stops, angle,
    // position sliders) needs the whole panel width — squeezed into one
    // half of the 2-column accordion grid it overflowed/overlapped.
    <Field label={label} full>
      <ColorPicker value={rgba} onChange={onChange} allowGradient />
    </Field>
  );
}
