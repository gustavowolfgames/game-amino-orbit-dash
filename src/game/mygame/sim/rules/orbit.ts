/** Pure geometry and timing for Orbit Dash. Units are design pixels or milliseconds. */
export const TAU = Math.PI * 2;
export const CENTER_X = 195;
export const CENTER_Y = 430;
export const LANE_RADII = [105, 155] as const;
export const GATE_COUNT = 5;
export const START_SHIELDS = 3;
export const RUN_MS = 45_000;
export const BASE_SPEED = 1.2; // radians per second
export const SPEED_PER_LEVEL = 0.08;

export function orbitPoint(
  angle: number,
  lane: number,
): { x: number; y: number } {
  const radius = LANE_RADII[lane === 0 ? 0 : 1];
  return {
    x: CENTER_X + Math.cos(angle) * radius,
    y: CENTER_Y + Math.sin(angle) * radius,
  };
}
