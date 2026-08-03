import { Field } from '../shared/fields.jsx';
import ColorPicker from '../shared/ColorPicker.jsx';

export default function BackgroundSection({ rgba, onChange, label = 'Màu nền bubble' }) {
  return (
    <Field label={label} full>
      <ColorPicker value={rgba} onChange={onChange} allowGradient />
    </Field>
  );
}
