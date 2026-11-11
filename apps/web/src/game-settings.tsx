import { useId, useLayoutEffect, useRef } from "react";
import "./game-settings.css";

export type RenderQuality = "low" | "balanced" | "high";

export type GameSettings = {
  renderQuality: RenderQuality;
  lookSensitivity: number;
  invertY: boolean;
  showControlHints: boolean;
  fieldOfView: number;
  reducedMotion: boolean;
};

const storageKey = "gta-mmmut.settings.v1";
const minimumSensitivity = 0.5;
const maximumSensitivity = 1.5;

export const defaultGameSettings: Readonly<GameSettings> = Object.freeze({
  renderQuality: "balanced",
  lookSensitivity: 1,
  invertY: false,
  showControlHints: true,
  fieldOfView: 46,
  reducedMotion: false,
});

function isRenderQuality(value: unknown): value is RenderQuality {
  return value === "low" || value === "balanced" || value === "high";
}

export function loadGameSettings(): GameSettings {
  try {
    const stored = window.localStorage.getItem(storageKey);
    const value: unknown = stored === null ? null : JSON.parse(stored);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { ...defaultGameSettings };
    }

    const settings = value as Record<string, unknown>;
    const { renderQuality, lookSensitivity, invertY, showControlHints, fieldOfView, reducedMotion } = settings;
    return {
      renderQuality: isRenderQuality(renderQuality) ? renderQuality : defaultGameSettings.renderQuality,
      lookSensitivity: typeof lookSensitivity === "number"
        && lookSensitivity >= minimumSensitivity
        && lookSensitivity <= maximumSensitivity
        ? lookSensitivity
        : defaultGameSettings.lookSensitivity,
      invertY: typeof invertY === "boolean" ? invertY : defaultGameSettings.invertY,
      showControlHints: typeof showControlHints === "boolean"
        ? showControlHints
        : defaultGameSettings.showControlHints,
      fieldOfView: typeof fieldOfView === "number" && fieldOfView >= 35 && fieldOfView <= 74
        ? fieldOfView : defaultGameSettings.fieldOfView,
      reducedMotion: reducedMotion === true,
    };
  } catch {
    return { ...defaultGameSettings };
  }
}

export function saveGameSettings(value: GameSettings): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Settings can still apply for this session when storage is unavailable.
  }
}

type GameSettingsPanelProps = {
  value: GameSettings;
  onChange: (value: GameSettings) => void;
  onClose: () => void;
};

export function GameSettingsPanel({ value, onChange, onClose }: GameSettingsPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const sensitivityPercent = Math.round(value.lookSensitivity * 100);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="game-settings"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="game-settings-header">
        <p>Campus preview</p>
        <h2 id={`${id}-title`}>Settings</h2>
      </header>

      <div className="game-settings-fields">
        <div className="game-settings-field">
          <label htmlFor={`${id}-quality`}>Render quality</label>
          <select
            id={`${id}-quality`}
            value={value.renderQuality}
            aria-describedby={`${id}-quality-description`}
            onChange={(event) => {
              const renderQuality = event.currentTarget.value;
              if (isRenderQuality(renderQuality)) onChange({ ...value, renderQuality });
            }}
          >
            <option value="low">Low</option>
            <option value="balanced">Balanced</option>
            <option value="high">High</option>
          </select>
          <small id={`${id}-quality-description`}>Adjusts the 3D render resolution.</small>
        </div>

        <div className="game-settings-field">
          <div className="game-settings-range-label">
            <label htmlFor={`${id}-sensitivity`}>Look sensitivity</label>
            <span aria-hidden="true">{sensitivityPercent}%</span>
          </div>
          <input
            id={`${id}-sensitivity`}
            type="range"
            min={minimumSensitivity * 100}
            max={maximumSensitivity * 100}
            value={sensitivityPercent}
            aria-valuetext={`${sensitivityPercent}%`}
            onChange={(event) => onChange({
              ...value,
              lookSensitivity: event.currentTarget.valueAsNumber / 100,
            })}
          />
        </div>

        <label className="game-settings-check">
          <input
            type="checkbox"
            checked={value.invertY}
            onChange={(event) => onChange({ ...value, invertY: event.currentTarget.checked })}
          />
          Invert vertical look
        </label>

        <label className="game-settings-check">
          <input
            type="checkbox"
            checked={value.showControlHints}
            onChange={(event) => onChange({ ...value, showControlHints: event.currentTarget.checked })}
          />
          Show control hints
        </label>
        <div className="game-settings-field">
          <label htmlFor={`${id}-fov`}>Player field of view</label>
          <input id={`${id}-fov`} type="range" min="35" max="74" step="1" value={value.fieldOfView}
            onChange={(event) => onChange({ ...value, fieldOfView: event.currentTarget.valueAsNumber })} />
          <small>{value.fieldOfView}° vertical field of view</small>
        </div>
        <label className="game-settings-check">
          <input type="checkbox" checked={value.reducedMotion}
            onChange={(event) => onChange({ ...value, reducedMotion: event.currentTarget.checked })} />
          Reduce camera motion
        </label>
      </div>

      <details className="game-settings-credits">
        <summary>Vehicle model credits</summary>
        <p>
          <a href="https://sketchfab.com/3d-models/2022-maruti-suzuki-swift-dzire-95451c00cb2d48778f67d798167e7237" target="_blank" rel="noreferrer">Swift Dzire</a>
          {" and "}
          <a href="https://sketchfab.com/3d-models/2020-maruti-suzuki-alto-800-dad66ee4a05a4f51bd0b9bf64ba6d4ef" target="_blank" rel="noreferrer">Alto 800</a>
          {" by BHP3D. Geometry and textures were reduced, and the cars were resized and fitted with wheel pivots."}
        </p>
        <p>
          <a href="https://sketchfab.com/3d-models/indian-car-scorpio-3d-model-for-free-4905188a9985423db9c9b67ec97a7c29" target="_blank" rel="noreferrer">Scorpio</a>
          {" by Gouravsuthar. Resized and fitted with simplified tires and wheel pivots."}
        </p>
        <p><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>
      </details>

      <footer className="game-settings-actions">
        <button type="button" onClick={() => onChange({ ...defaultGameSettings })}>
          Reset defaults
        </button>
        <button type="button" className="game-settings-done" onClick={onClose}>Done</button>
      </footer>
    </dialog>
  );
}
