export const OWNER_NOTIFICATION_SOUND_KEY = 'ownerNotificationSound';
export const OWNER_NOTIFICATION_READY_KEY = 'ownerNotificationReady';

export const NOTIFICATION_SOUND_PRESETS = [
  {
    key: 'service-bell',
    name: 'Service Bell',
    description: 'Bright double bell for counter orders.',
    notes: [
      { frequency: 880, overtone: 1320, duration: 0.48, offset: 0, volume: 0.68 },
      { frequency: 880, overtone: 1320, duration: 0.48, offset: 0.32, volume: 0.68 },
    ],
  },
  {
    key: 'kitchen-bell',
    name: 'Kitchen Bell',
    description: 'Sharper, louder kitchen pass bell.',
    notes: [
      { frequency: 980, overtone: 1470, duration: 0.44, offset: 0, volume: 0.72 },
      { frequency: 980, overtone: 1470, duration: 0.44, offset: 0.26, volume: 0.72 },
    ],
  },
  {
    key: 'front-desk',
    name: 'Front Desk Chime',
    description: 'Fast rising double chime.',
    notes: [
      { frequency: 740, overtone: 1110, duration: 0.36, offset: 0, volume: 0.64 },
      { frequency: 1040, overtone: 1560, duration: 0.4, offset: 0.24, volume: 0.68 },
    ],
  },
  {
    key: 'rush-alert',
    name: 'Rush Alert',
    description: 'Punchier triple pulse for busy hours.',
    notes: [
      { frequency: 920, overtone: 1380, duration: 0.26, offset: 0, volume: 0.7 },
      { frequency: 920, overtone: 1380, duration: 0.26, offset: 0.2, volume: 0.7 },
      { frequency: 920, overtone: 1380, duration: 0.26, offset: 0.4, volume: 0.7 },
    ],
  },
  {
    key: 'counter-clang',
    name: 'Counter Clang',
    description: 'Metallic alert with more bite.',
    notes: [
      { frequency: 820, overtone: 1640, duration: 0.5, offset: 0, volume: 0.74 },
      { frequency: 820, overtone: 1640, duration: 0.5, offset: 0.34, volume: 0.74 },
    ],
  },
];

export function getStoredNotificationSound() {
  if (typeof window === 'undefined') {
    return NOTIFICATION_SOUND_PRESETS[0].key;
  }

  const saved = window.localStorage.getItem(OWNER_NOTIFICATION_SOUND_KEY);
  return NOTIFICATION_SOUND_PRESETS.some((preset) => preset.key === saved)
    ? saved
    : NOTIFICATION_SOUND_PRESETS[0].key;
}

export function setStoredNotificationSound(presetKey) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(OWNER_NOTIFICATION_SOUND_KEY, presetKey);
}

export function getStoredNotificationReady() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.sessionStorage.getItem(OWNER_NOTIFICATION_READY_KEY) === 'true';
}

export function setStoredNotificationReady(isReady) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(OWNER_NOTIFICATION_READY_KEY, isReady ? 'true' : 'false');
}

export function playNotificationPreset({ audioContext, presetKey }) {
  if (!audioContext) {
    return;
  }

  const preset =
    NOTIFICATION_SOUND_PRESETS.find((option) => option.key === presetKey) ||
    NOTIFICATION_SOUND_PRESETS[0];

  const startAt = audioContext.currentTime;
  const masterGain = audioContext.createGain();
  const compressor = audioContext.createDynamicsCompressor();

  masterGain.gain.setValueAtTime(1, startAt);
  compressor.threshold.setValueAtTime(-18, startAt);
  compressor.knee.setValueAtTime(20, startAt);
  compressor.ratio.setValueAtTime(10, startAt);
  compressor.attack.setValueAtTime(0.003, startAt);
  compressor.release.setValueAtTime(0.18, startAt);

  masterGain.connect(compressor);
  compressor.connect(audioContext.destination);

  preset.notes.forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const overtone = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    overtone.type = 'triangle';

    oscillator.frequency.setValueAtTime(note.frequency, startAt + note.offset);
    overtone.frequency.setValueAtTime(note.overtone, startAt + note.offset);

    gainNode.gain.setValueAtTime(0.0001, startAt + note.offset);
    gainNode.gain.exponentialRampToValueAtTime(note.volume, startAt + note.offset + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(note.volume * 0.7, startAt + note.offset + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + note.offset + note.duration);

    oscillator.connect(gainNode);
    overtone.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.start(startAt + note.offset);
    overtone.start(startAt + note.offset);
    oscillator.stop(startAt + note.offset + note.duration + 0.02);
    overtone.stop(startAt + note.offset + Math.max(0.12, note.duration - 0.08));
  });
}
