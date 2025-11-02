import { DTMFGenerator } from '../dist/index.js';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

const generator = new DTMFGenerator({
  defaultToneDurationMs: 100,
  defaultPauseMs: 20,
});

const codesInput = $('codesInput') as HTMLInputElement;
const playBtn = $('playBtn');
const clearBtn = $('clearBtn');

// Обработчик клика по клавишам
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const code = target.dataset.code;
  
  if (code) {
    // Добавляем код в поле ввода
    codesInput.value += code;
    // Воспроизводим звук
    generator.synthesize(code);
  }
});

// Воспроизведение всей последовательности
playBtn.addEventListener('click', () => {
  const codes = codesInput.value;
  if (codes) {
    generator.synthesize(codes, undefined, undefined, undefined, true);
  }
});

// Очистка поля ввода
clearBtn.addEventListener('click', () => {
  codesInput.value = '';
});
