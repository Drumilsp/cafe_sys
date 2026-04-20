import { useMemo, useState } from 'react';
import OwnerLayout from '../components/OwnerLayout';
import {
  getStoredNotificationReady,
  getStoredNotificationSound,
  NOTIFICATION_SOUND_PRESETS,
  playNotificationPreset,
  setStoredNotificationReady,
  setStoredNotificationSound,
} from '../utils/notificationSounds';
import './Settings.css';

const Settings = () => {
  const [selectedSound, setSelectedSound] = useState(getStoredNotificationSound());
  const [isTesting, setIsTesting] = useState(false);

  const activePreset = useMemo(
    () => NOTIFICATION_SOUND_PRESETS.find((preset) => preset.key === selectedSound),
    [selectedSound]
  );

  const handleSoundChange = (presetKey) => {
    setSelectedSound(presetKey);
    setStoredNotificationSound(presetKey);
  };

  const handleSoundCheck = async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      window.alert('This browser does not support audio testing.');
      return;
    }

    setIsTesting(true);

    try {
      const context = new AudioContextClass();
      if (context.state === 'suspended') {
        await context.resume();
      }

      setStoredNotificationReady(true);

      playNotificationPreset({
        audioContext: context,
        presetKey: selectedSound,
      });

      window.setTimeout(() => {
        context.close().catch(() => {});
      }, 1400);
    } catch (error) {
      console.error('Failed to test notification sound:', error);
      window.alert('Sound test failed. Tap the button again after interacting with the page.');
    } finally {
      window.setTimeout(() => {
        setIsTesting(false);
      }, 600);
    }
  };

  return (
    <OwnerLayout title="Settings">
      <section className="settings-card">
        <div className="settings-card-header">
          <div>
            <p className="settings-eyebrow">Notifications</p>
            <h2>Order Alert Sound</h2>
          </div>
          <button
            type="button"
            className="sound-check-btn"
            onClick={handleSoundCheck}
            disabled={isTesting}
          >
            {isTesting ? 'Playing...' : 'Sound Check'}
          </button>
        </div>

        <p className="settings-help">
          Choose the alert sound for new orders. This setting is saved on this device.
        </p>

        <div className="sound-options-grid">
          {NOTIFICATION_SOUND_PRESETS.map((preset) => (
            <label
              key={preset.key}
              className={`sound-option-card ${selectedSound === preset.key ? 'active' : ''}`}
            >
              <input
                type="radio"
                name="notification-sound"
                value={preset.key}
                checked={selectedSound === preset.key}
                onChange={() => handleSoundChange(preset.key)}
              />
              <div>
                <div className="sound-option-title-row">
                  <span className="sound-option-title">{preset.name}</span>
                  {selectedSound === preset.key && <span className="sound-selected-badge">Selected</span>}
                </div>
                <p className="sound-option-description">{preset.description}</p>
              </div>
            </label>
          ))}
        </div>

        {activePreset && (
          <div className="settings-note">
            Current sound: <strong>{activePreset.name}</strong>
          </div>
        )}
      </section>
    </OwnerLayout>
  );
};

export default Settings;
