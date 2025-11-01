import DTMFDetector from '../dist/index.js';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

let det: DTMFDetector | null = null;
let codesInput: HTMLInputElement;
let logElement: HTMLElement;
let enabledCheckbox: HTMLInputElement;
let settingsModal: HTMLElement;

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
      } catch (e) {
        log('Start failed: ' + (e as Error).message);
        det = null;
        enabledCheckbox.checked = false;
      }
    }
  }
}

// Инициализация элементов
document.addEventListener('DOMContentLoaded', async () => {
  codesInput = $('codesInput') as HTMLInputElement;
  logElement = $('log');
  enabledCheckbox = $('enabled') as HTMLInputElement;
  settingsModal = $('settingsModal');

  // Обработчик чекбокса включения/выключения
  enabledCheckbox.onchange = async () => {
    if (enabledCheckbox.checked) {
      if (!det) {
        await createDetector();
      } else {
        try {
          await det.start();
        } catch (e) {
          log('Start failed: ' + (e as Error).message);
          enabledCheckbox.checked = false;
        }
      }
    } else {
      if (det) {
        await det.stop();
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
    if (det) {
      await det.stop();
    }
    await createDetector();
    if (wasEnabled && det) {
      enabledCheckbox.checked = true;
      try {
        await det.start();
      } catch (e) {
        log('Start failed: ' + (e as Error).message);
        enabledCheckbox.checked = false;
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

  // Автостарт детектора при открытии страницы
  enabledCheckbox.checked = true;
  await createDetector();
});
