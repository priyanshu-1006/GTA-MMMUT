export const playerAppearanceOptions = {
  skin: [
    { id: "skin-bronze", label: "Bronze", color: "#bb8d69", pack: "skins02_cc0" },
    { id: "skin-indian", label: "Indian Enhanced", color: "#a57155", pack: "skins01_cc0" },
    { id: "skin-mid-tone", label: "Warm mid-tone", color: "#c09278", pack: "skins01_cc0" },
    { id: "skin-eurasian", label: "Soft warm", color: "#d2a992", pack: "skins01_cc0" },
    { id: "skin-freckled", label: "Freckled", color: "#d0a087", pack: "skins02_cc0" },
    { id: "skin-deep", label: "Deep warm", color: "#795340", pack: "skins02_cc0" },
  ],
  shirt: [
    { id: "slate-polo", label: "Slate blue polo", color: "#446474" },
    { id: "olive-polo", label: "Olive polo", color: "#697958" },
    { id: "cream-polo", label: "Cream polo", color: "#d8cfb6" },
  ],
  pants: [
    { id: "indigo-jeans", label: "Indigo jeans", color: "#40536c" },
    { id: "charcoal-jeans", label: "Charcoal jeans", color: "#41474a" },
    { id: "stone-jeans", label: "Stone jeans", color: "#a69e8e" },
  ],
  hair: [
    { id: "black-hair", label: "Natural black", color: "#252322" },
    { id: "brown-hair", label: "Dark brown", color: "#493229" },
    { id: "ash-hair", label: "Ash grey", color: "#68605a" },
  ],
  shoes: [
    { id: "white-runners", label: "Off-white running shoes", color: "#dbd8cb" },
    { id: "black-runners", label: "Black running shoes", color: "#363b3c" },
    { id: "moss-runners", label: "Moss running shoes", color: "#6a7659" },
  ],
} as const;

type AppearanceOptions = typeof playerAppearanceOptions;
export type PlayerAppearance = {
  [Category in keyof AppearanceOptions]: AppearanceOptions[Category][number]["id"];
};

export const defaultPlayerAppearance: Readonly<PlayerAppearance> = Object.freeze({
  skin: "skin-bronze",
  shirt: "slate-polo",
  pants: "indigo-jeans",
  hair: "black-hair",
  shoes: "white-runners",
});

// An outfit preset leaves the player's skin selection intact.
export const playerAppearancePresets = [
  {
    id: "campus-everyday",
    label: "Campus everyday",
    outfit: { shirt: "slate-polo", pants: "indigo-jeans", hair: "black-hair", shoes: "white-runners" },
  },
  {
    id: "lecture-day",
    label: "Lecture day",
    outfit: { shirt: "cream-polo", pants: "charcoal-jeans", hair: "brown-hair", shoes: "black-runners" },
  },
  {
    id: "afternoon-casual",
    label: "Afternoon casual",
    outfit: { shirt: "olive-polo", pants: "stone-jeans", hair: "ash-hair", shoes: "moss-runners" },
  },
] as const satisfies readonly {
  id: string;
  label: string;
  outfit: Omit<PlayerAppearance, "skin">;
}[];

const storageKey = "gta-mmmut.player-appearance.v1";

function readOption<Id extends string>(
  options: readonly { id: Id; color: string }[],
  value: unknown,
): { id: Id; color: string } {
  return options.find(({ id }) => id === value) ?? options[0];
}

function parseAppearance(value: unknown): PlayerAppearance {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaultPlayerAppearance };
  }
  const { skin, shirt, pants, hair, shoes } = value as Record<string, unknown>;
  return {
    skin: readOption(playerAppearanceOptions.skin, skin).id,
    shirt: readOption(playerAppearanceOptions.shirt, shirt).id,
    pants: readOption(playerAppearanceOptions.pants, pants).id,
    hair: readOption(playerAppearanceOptions.hair, hair).id,
    shoes: readOption(playerAppearanceOptions.shoes, shoes).id,
  };
}

export function getPlayerAppearanceColors(value: PlayerAppearance) {
  return {
    skin: readOption(playerAppearanceOptions.skin, value.skin).color,
    shirt: readOption(playerAppearanceOptions.shirt, value.shirt).color,
    pants: readOption(playerAppearanceOptions.pants, value.pants).color,
    hair: readOption(playerAppearanceOptions.hair, value.hair).color,
    shoes: readOption(playerAppearanceOptions.shoes, value.shoes).color,
  };
}

export function loadPlayerAppearance(): PlayerAppearance {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return parseAppearance(stored === null ? null : JSON.parse(stored));
  } catch {
    return { ...defaultPlayerAppearance };
  }
}

export function savePlayerAppearance(value: PlayerAppearance): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(parseAppearance(value)));
  } catch {
    // Keep the current appearance for the session when storage is unavailable.
  }
}
