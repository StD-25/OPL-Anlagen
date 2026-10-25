// Auswahlfeld: Antippen öffnet das dunkle Auswahlfenster (Einfachauswahl).
import { esc } from './ui.js';
import { pickOne } from './picker.js';

export function choicePicker(container, { value = '', options = [], placeholder = 'Bitte auswählen', disabled = false, onChange } = {}) {
  let choice = value;
  container.innerHTML = `<button type="button" class="picker-field" ${disabled ? 'disabled' : ''}></button>`;
  const field = container.querySelector('.picker-field');

  function render() {
    field.innerHTML = choice ? `<span>${esc(choice)}</span>` : `<span class="placeholder">${esc(placeholder)}</span>`;
  }
  render();

  field.onclick = async () => {
    // Nicht mehr in der Liste vorhandener Wert (z.B. umbenannt) bleibt wählbar
    const list = choice && !options.includes(choice) ? [choice, ...options] : options;
    const picked = await pickOne({ options: list, selected: choice, rows: 9 });
    if (picked === null || picked === choice) return;
    choice = picked;
    render();
    onChange?.(choice);
  };

  return {
    getValue: () => choice,
    reset() { choice = ''; render(); },
  };
}
