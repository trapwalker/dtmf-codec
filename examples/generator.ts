import { DTMFGenerator } from '../dist/index.js';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

const generator = new DTMFGenerator({
  defaultToneDurationMs: 100,
  defaultPauseMs: 20,
});

const codesInput = $('codesInput') as HTMLInputElement;
const playBtn = $('playBtn');
const clearBtn = $('clearBtn');

// Функция обработки нажатия клавиши
const handleKeyPress = (e: Event) => {
  const target = e.target as HTMLElement;
  const code = target.dataset.code;
  
  if (code && (target.classList.contains('key') || target.classList.contains('key-letter'))) {
    // Добавляем код в поле ввода
    codesInput.value += code;
    // Воспроизводим звук
    generator.synthesize(code, 5000);
  }
};

// Функция обработки отпускания клавиши
const handleKeyRelease = () => {
  // Останавливаем звук при отпускании
  generator.synthesize('');
};

// Обработчики нажатия для клавиш
document.addEventListener('mousedown', handleKeyPress);
document.addEventListener('touchstart', handleKeyPress);

// Обработчики отпускания для клавиш (на документе, чтобы сработало даже если мышь ушла с кнопки)
document.addEventListener('mouseup', handleKeyRelease);
document.addEventListener('touchend', handleKeyRelease);

// Воспроизведение всей последовательности
playBtn.addEventListener('click', () => {
  const codes = codesInput.value;
  if (codes) {
    generator.synthesize(codes, undefined, undefined, undefined, true);
  }
});

// Очистка поля ввода и остановка звука
clearBtn.addEventListener('click', () => {
  codesInput.value = '';
  generator.synthesize(''); // Останавливаем текущее воспроизведение
});
