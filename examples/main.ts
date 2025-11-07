import DTMFDetector from '../dist/index.js';
import { DTMFGenerator } from '../dist/index.js';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

let det: DTMFDetector | null = null;
let codesInput: HTMLInputElement;
let logElement: HTMLElement;
let enabledCheckbox: HTMLInputElement;
let settingsModal: HTMLElement;
let micIcon: HTMLElement;

// Генератор DTMF
const generator = new DTMFGenerator({
  defaultToneDurationMs: 100,
  defaultPauseMs: 20,
});
let generatorCodesInput: HTMLInputElement;
let generatorContent: HTMLElement;
let generatorToggleIcon: HTMLElement;

// Функция для добавления записи в журнал (сверху)
const log = (msg: string) => {
  const el = logElement;
  const newLine = document.createTextNode(msg);
  const br = document.createElement('br');
  el.insertBefore(newLine, el.firstChild);
  el.insertBefore(br, el.firstChild);
};

// Функция создания детектора с текущими настройками
async function createDetector(): Promise<void> {
  // Останавливаем существующий детектор
  if (det) {
    await det.stop();
    det = null;
  }

  const minToneStartMs = Number((document.getElementById('minToneStartMs') as HTMLInputElement).value);
  const minSilenceMs = Number((document.getElementById('minSilenceMs') as HTMLInputElement).value);
  const snrDb = Number((document.getElementById('snrDb') as HTMLInputElement).value);
  const sequenceTimeoutMsInput = (document.getElementById('sequenceTimeoutMs') as HTMLInputElement).value;
  const sequenceTimeoutMs = sequenceTimeoutMsInput ? Number(sequenceTimeoutMsInput) : undefined;

  const opts: any = { minToneStartMs, minSilenceMs, snrDb };
  if (sequenceTimeoutMs !== undefined) {
    opts.sequenceTimeoutMs = sequenceTimeoutMs;
  }

  det = new (DTMFDetector as any)(opts);

  // По on_tone_start добавляем код в текстовое поле
  if (det) {
    det.on_tone_start = (c: string) => {
      codesInput.value += c;
    };

    // По on_sequence_end добавляем sequence в журнал и очищаем поле
    det.on_sequence_end = (sequence: string) => {
      log(`sequence: "${sequence}"`);
      codesInput.value = '';
    };

    // Если детектор включен, запускаем его
    if (enabledCheckbox.checked) {
      try {
        await det.start();
        micIcon.classList.add('active');
      } catch (e) {
        log('Start failed: ' + (e as Error).message);
        det = null;
        enabledCheckbox.checked = false;
        micIcon.classList.remove('active');
      }
    }
  }
}

// Инициализация элементов
document.addEventListener('DOMContentLoaded', async () => {
  // Сначала инициализируем ВСЕ элементы
  codesInput = $('codesInput') as HTMLInputElement;
  logElement = $('log');
  enabledCheckbox = $('enabled') as HTMLInputElement;
  settingsModal = $('settingsModal');
  micIcon = $('micIcon');
  generatorCodesInput = $('generatorCodesInput') as HTMLInputElement;
  generatorContent = $('generatorContent');
  const generatorToggleEl = $('generatorToggle');
  generatorToggleIcon = generatorToggleEl.querySelector('.generator-toggle-icon') as HTMLElement;

  // Обработчик чекбокса включения/выключения
  enabledCheckbox.onchange = async () => {
    if (enabledCheckbox.checked) {
      if (!det) {
        await createDetector();
      } else {
        try {
          await det.start();
          micIcon.classList.add('active');
        } catch (e) {
          log('Start failed: ' + (e as Error).message);
          enabledCheckbox.checked = false;
          micIcon.classList.remove('active');
        }
      }
    } else {
      if (det) {
        await det.stop();
        micIcon.classList.remove('active');
      }
    }
  };

  // Кнопка настроек
  ($('settings') as HTMLButtonElement).onclick = () => {
    settingsModal.classList.add('active');
  };

  // Закрытие модального диалога
  ($('closeModal') as HTMLButtonElement).onclick = () => {
    settingsModal.classList.remove('active');
  };

  ($('cancelSettings') as HTMLButtonElement).onclick = () => {
    settingsModal.classList.remove('active');
  };

  // Сохранение настроек и пересоздание детектора
  ($('saveSettings') as HTMLButtonElement).onclick = async () => {
    const wasEnabled = enabledCheckbox.checked;
    enabledCheckbox.checked = false;
    micIcon.classList.remove('active');
    if (det) {
      await det.stop();
    }
    await createDetector();
    if (wasEnabled && det) {
      enabledCheckbox.checked = true;
      try {
        await det.start();
        micIcon.classList.add('active');
      } catch (e) {
        log('Start failed: ' + (e as Error).message);
        enabledCheckbox.checked = false;
        micIcon.classList.remove('active');
      }
    }
    settingsModal.classList.remove('active');
  };

  // Закрытие модального окна при клике вне его
  settingsModal.onclick = (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove('active');
    }
  };

  // Обработчик переключения видимости генератора
  generatorToggleEl.onclick = () => {
    const isExpanded = generatorContent.classList.contains('expanded');
    if (isExpanded) {
      generatorContent.classList.remove('expanded');
      generatorToggleIcon.classList.remove('expanded');
    } else {
      generatorContent.classList.add('expanded');
      generatorToggleIcon.classList.add('expanded');
    }
  };

  // Функция обработки нажатия клавиши генератора
  const handleKeyPress = (e: Event) => {
    const target = e.target as HTMLElement;
    const code = target.dataset.code;

    if (code && (target.classList.contains('key') || target.classList.contains('key-letter'))) {
      // Добавляем код в поле ввода
      generatorCodesInput.value += code;
      // Воспроизводим звук
      generator.synthesize(code, 5000);
    }
  };

  // Функция обработки отпускания клавиши генератора
  const handleKeyRelease = () => {
    // Останавливаем звук при отпускании
    generator.synthesize('');
  };

  // Обработчики нажатия для клавиш
  document.addEventListener('mousedown', handleKeyPress);
  document.addEventListener('touchstart', handleKeyPress);

  // Обработчики отпускания для клавиш
  document.addEventListener('mouseup', handleKeyRelease);
  document.addEventListener('touchend', handleKeyRelease);

  // Воспроизведение всей последовательности
  ($('playBtn') as HTMLButtonElement).onclick = () => {
    const codes = generatorCodesInput.value;
    if (codes) {
      generator.synthesize(codes, undefined, undefined, undefined, true);
    }
  };

  // Очистка поля ввода и остановка звука
  ($('clearBtn') as HTMLButtonElement).onclick = () => {
    generatorCodesInput.value = '';
    generator.synthesize(''); // Останавливаем текущее воспроизведение
  };

  // Создаем детектор заранее (но не запускаем автоматически)
  await createDetector();

  log('Включите детектор с помощью чекбокса для начала работы');
});
