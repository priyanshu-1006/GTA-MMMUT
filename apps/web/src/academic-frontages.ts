import { annotationToWorld, type AnnotationPoint } from "@gta-mmmut/world-data";

function frontage(buildingId: string, door: AnnotationPoint, outward: 1 | -1, view = door) {
  return { buildingId, door: annotationToWorld(door), outward, view: annotationToWorld(view) };
}

// Door positions follow the traced walls and the owner's orientation. The hall
// doors align through a clear bay of the existing covered walkway.
export const academicFrontages = {
  takshashila: frontage("B47", [1288.7, 332], -1),
  pushpagiri: frontage("B45", [1288.7, 308], 1),
  ece: frontage("B46", [1187.5, 314], 1, [1194.5, 314]),
  electrical: frontage("B32", [1069, 320], 1),
} as const;

export const lectureEntranceWidth = 3;
