import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import {
  defaultPlayerAppearance,
  getPlayerAppearanceColors,
  playerAppearanceOptions,
  playerAppearancePresets,
  type PlayerAppearance,
} from "./player-appearance";
import "./player-wardrobe.css";

type PlayerWardrobeProps = {
  value: PlayerAppearance;
  onChange: (value: PlayerAppearance) => void;
  onClose: () => void;
  preview?: ReactNode;
};

const skinPacks = ["skins01_cc0", "skins02_cc0"] as const;

function ColorPreview({ value }: { value: PlayerAppearance }) {
  const { skin, shirt, pants, hair, shoes } = getPlayerAppearanceColors(value);
  return (
    <svg className="wardrobe-color-preview" role="img" aria-label="Current outfit color preview" viewBox="0 0 168 245">
      <ellipse cx="84" cy="226" rx="52" ry="8" fill="#12281f" />
      <path d="M69 25 Q84 11 99 25 V54 Q93 67 84 67 Q75 67 69 54Z" fill={skin} />
      <path d="M67 43 L66 29 Q68 15 82 14 Q96 12 102 26 L101 42 Q95 39 92 31 Q82 40 67 43Z" fill={hair} />
      <path d="M78 61 H90 L93 72 L84 81 L75 72Z" fill={skin} />
      <path d="M50 92 L60 98 L56 136 Q54 143 48 141 Q43 138 45 131Z M108 98 L118 92 L123 131 Q125 138 120 141 Q114 143 112 136Z" fill={skin} />
      <path d="M65 124 H103 L101 165 L98 211 H87 L84 166 L81 211 H70 L67 165Z" fill={pants} />
      <path d="M59 78 L75 70 L84 79 L93 70 L109 78 L122 101 L109 109 L104 99 L104 130 H64 V99 L59 109 L46 101Z" fill={shirt} />
      <path d="M75 72 L84 79 L93 72 M84 79 V90 M83 132 L85 132 L84 163" fill="none" stroke="#16281f" strokeOpacity=".48" strokeWidth="2" />
      <path d="M69 207 H81 V219 H62 V216 Q64 210 69 207Z M87 207 H99 Q104 210 106 216 V219 H87Z" fill={shoes} />
    </svg>
  );
}

export function PlayerWardrobe({ value, onChange, onClose, preview }: PlayerWardrobeProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();

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

  function appearanceSelect(category: Exclude<keyof PlayerAppearance, "skin">, label: string) {
    const options = playerAppearanceOptions[category];
    return (
      <label className="wardrobe-select">
        <span>{label}</span>
        <select
          value={value[category]}
          onChange={(event) => {
            const option = options.find(({ id: optionId }) => optionId === event.currentTarget.value);
            if (option) onChange({ ...value, [category]: option.id });
          }}
        >
          {options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
        </select>
      </label>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="player-wardrobe"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="wardrobe-header">
        <p>Campus player</p>
        <h2 id={`${id}-title`}>Wardrobe</h2>
      </header>
      <div className="wardrobe-content">
        <div className="wardrobe-preview">
          <div className="wardrobe-preview-stage">{preview ?? <ColorPreview value={value} />}</div>
          <span>{preview ? "Character preview" : "Outfit colors"}</span>
        </div>
        <div className="wardrobe-controls">
          <fieldset>
            <legend>Presets</legend>
            <div className="wardrobe-presets">
              {playerAppearancePresets.map(({ id: presetId, label, outfit }) => (
                <button
                  key={presetId}
                  type="button"
                  aria-pressed={value.shirt === outfit.shirt && value.pants === outfit.pants
                    && value.hair === outfit.hair && value.shoes === outfit.shoes}
                  onClick={() => onChange({ ...value, ...outfit })}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Skins</legend>
            <div className="wardrobe-skins">
              {skinPacks.map((pack) => (
                <div className="wardrobe-skin-pack" role="group" aria-label={pack} key={pack}>
                  <p>{pack}</p>
                  {playerAppearanceOptions.skin.filter((skin) => skin.pack === pack).map((skin) => (
                    <label className="wardrobe-skin" key={skin.id}>
                      <input
                        type="radio"
                        name={`${id}-skin`}
                        checked={value.skin === skin.id}
                        onChange={() => onChange({ ...value, skin: skin.id })}
                      />
                      <span className="wardrobe-swatch" style={{ backgroundColor: skin.color }} aria-hidden="true" />
                      <strong>{skin.label}</strong>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Clothing</legend>
            <div className="wardrobe-select-grid">
              {appearanceSelect("shirt", "Shirt")}
              {appearanceSelect("pants", "Pants")}
            </div>
          </fieldset>
          <div className="wardrobe-select-grid">
            {appearanceSelect("hair", "Hair")}
            {appearanceSelect("shoes", "Shoes")}
          </div>
        </div>
      </div>
      <details className="wardrobe-credits">
        <summary>Clothing credits</summary>
        <p>Jeans and shoes by punkduck. Both were fitted, skinned, and exported with resized textures.</p>
        <p><a href="https://www.makehumancommunity.org/node/1655">Male Classic Jeans</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p>
        <p><a href="https://www.makehumancommunity.org/node/570">Running Shoes</a> · <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a></p>
      </details>
      <footer className="wardrobe-actions">
        <button type="button" onClick={() => onChange({ ...defaultPlayerAppearance })}>Reset appearance</button>
        <button type="button" className="wardrobe-done" onClick={onClose}>Done</button>
      </footer>
    </dialog>
  );
}
