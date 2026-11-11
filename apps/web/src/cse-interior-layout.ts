export type CseFloor = 0 | 1;
export type CseWing = "new" | "old";
export type CseRoomKind =
  "hod" | "office" | "faculty" | "staff" | "lab" | "conference" | "seminar" | "washroom" | "water";

export type CseBounds = readonly [minX: number, minZ: number, maxX: number, maxZ: number];

export interface CseRoom {
  readonly id: string;
  readonly label: string;
  readonly subtitle?: string;
  readonly floor: CseFloor;
  readonly wing: CseWing;
  readonly kind: CseRoomKind;
  readonly bounds: CseBounds;
  readonly door: readonly [x: number, z: number];
  readonly suite?: true;
}

const corridor = 1.75;
const wings = {
  new: { label: "New CSE", halfWidth: 10, front: 2, rear: -40 },
  old: { label: "Old CSE", halfWidth: 8.2, front: -45, rear: -78 },
} as const;

function room(
  wing: CseWing, floor: CseFloor, side: "left" | "right", front: number, rear: number,
  id: string, label: string, kind: CseRoomKind, subtitle?: string,
): CseRoom {
  const { halfWidth } = wings[wing];
  const right = side === "right";
  return {
    id, label, subtitle, floor, wing, kind,
    bounds: right ? [corridor, rear, halfWidth, front] : [-halfWidth, rear, -corridor, front],
    door: [right ? corridor : -corridor, (front + rear) / 2],
  };
}

function staffCabin(front: number, id: string, label: string): CseRoom {
  const rear = front - 3.2;
  return {
    id, label, floor: 1, wing: "new", kind: "faculty", suite: true,
    bounds: [4.3, rear, wings.new.halfWidth, front],
    door: [4.3, (front + rear) / 2],
  };
}

const rooms: readonly CseRoom[] = [
  room("new", 0, "left", 0, -7, "hod-cabin", "HOD Cabin", "hod", "Prof. Rakesh Kumar"),
  room("new", 0, "left", -7, -17.5, "common-office", "Common Office", "office"),
  room("new", 0, "right", 0, -9.5, "dsa-lab", "DSA Lab", "lab", "Data Structures and Algorithms"),
  room("new", 0, "right", -9.5, -18.5, "cn-lab", "CN Lab", "lab", "Computer Networks"),
  room("new", 0, "right", -18.5, -26.5, "conference-room", "Conference Room", "conference"),
  room("new", 0, "right", -26.5, -40, "cybersecurity-lab", "Cybersecurity and Blockchain Lab", "lab"),
  room("new", 0, "left", -31.8, -35.9, "new-ground-boys", "Boys’ Washroom", "washroom"),
  room("new", 0, "left", -35.9, -40, "new-ground-girls", "Girls’ Washroom", "washroom"),
  room("new", 1, "left", 0, -21.2, "alan-turing-hall", "Alan Turing Hall", "seminar", "Seminar Hall"),
  room("new", 1, "right", 0, -16, "staff-room", "Staff Room", "staff"),
  staffCabin(0, "sumit-kumar", "Dr. Sumit Kumar"),
  staffCabin(-3.2, "pawan-kumar-mall", "Dr. Pawan Kumar Mall"),
  staffCabin(-6.4, "pradeep-kumar-singh", "Dr. Pradeep Kumar Singh"),
  staffCabin(-9.6, "shailesh-kumar", "Dr. Shailesh Kumar"),
  staffCabin(-12.8, "rohit-kumar-tiwari", "Dr. Rohit Kumar Tiwari"),
  room("new", 1, "right", -16, -27, "computer-vision-lab", "Computer Vision Lab", "lab"),
  room("new", 1, "right", -27, -40, "iot-lab", "IoT Lab", "lab", "Internet of Things"),
  room("new", 1, "left", -31.8, -35.9, "new-first-boys", "Boys’ Washroom", "washroom"),
  room("new", 1, "left", -35.9, -40, "new-first-girls", "Girls’ Washroom", "washroom"),
  room("old", 0, "left", -45, -52.5, "lokendra-umrao", "Dr. Lokendra Umrao", "faculty"),
  room("old", 0, "left", -52.5, -60, "vipul-narayan", "Dr. Vipul Narayan", "faculty"),
  room("old", 0, "left", -60, -67.5, "ritesh-maurya", "Dr. Ritesh Maurya", "faculty"),
  room("old", 0, "right", -45, -56.5, "data-science-lab", "Data Science Lab", "lab"),
  room("old", 0, "right", -56.5, -67.5, "committee-room", "Committee Room", "conference"),
  room("old", 0, "right", -67.5, -78, "old-ground-washroom", "Washroom", "washroom"),
  room("old", 0, "left", -67.5, -78, "drinking-water", "Drinking Water", "water"),
  room("old", 1, "right", -45, -56, "dw-lab", "D&W Lab", "lab", "DBMS and Web Development"),
  room("old", 1, "right", -56, -67, "med-lab", "MED Lab", "lab", "Multi Edge Deployment"),
  room("old", 1, "right", -67, -78, "ar-vr-lab", "AR/VR Lab", "lab", "Augmented and Virtual Reality"),
  room("old", 1, "left", -45, -51.6, "satya-prakash-yadav", "Dr. Satya Prakash Yadav", "faculty"),
  room("old", 1, "left", -51.6, -58.2, "anu-raj", "Dr. Anu Raj", "faculty"),
  room("old", 1, "left", -58.2, -64.8, "abhishek-verma", "Dr. Abhishek Verma", "faculty"),
  room("old", 1, "left", -64.8, -71.4, "sushil-kumar-saroj", "Dr. Sushil Kumar Saroj", "faculty"),
  room("old", 1, "left", -71.4, -78, "swapnita-srivastava", "Dr. Swapnita Srivastava", "faculty"),
];

const stairs = {
  bounds: [-5.1, -31.8, -corridor, -21.2] as CseBounds,
  lowerRunZ: -23.5,
  upperRunZ: -29.5,
  lowerDoorZ: -22.35,
  upperDoorZ: -30.65,
  doorWidth: 1.75,
} as const;

export const cseInteriorLayout = {
  spawn: [0, 0, 0.9],
  extent: [-10.2, -78, 10.2, 2] as CseBounds,
  corridorHalfWidth: corridor,
  floorHeights: [0, 3.5],
  wings,
  stairs,
  rooms,
} as const;

export function cseStairHeightAt(x: number, z: number): number | undefined {
  const [left, rear, right, front] = stairs.bounds;
  if (x < left || x >= right || z < rear || z > front) return undefined;
  const progress = (stairs.lowerRunZ - z) / (stairs.lowerRunZ - stairs.upperRunZ);
  return Math.max(0, Math.min(1, progress)) * cseInteriorLayout.floorHeights[1];
}
