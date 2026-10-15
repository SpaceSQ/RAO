import { DAILY_LANES, assertFleetFloor } from '@/core/daily/lanes';
import type { GrokBotLaneInput, GrokBotLaneReport, GrokBotPort, LaneDefinition } from '@/core/daily/types';

export interface FleetInput {
  port: GrokBotPort;
  lanes?: LaneDefinition[];
  task: Omit<GrokBotLaneInput, 'lane'>;
}

/** Fan out one bot per lane. The split is the lane list, not a shared prompt. */
export async function runFleet(input: FleetInput): Promise<GrokBotLaneReport[]> {
  const lanes = input.lanes ?? DAILY_LANES;
  assertFleetFloor(lanes);
  return Promise.all(lanes.map((lane) => input.port.runLane({ ...input.task, lane })));
}
