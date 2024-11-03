import { type DayPrediction } from "@/lib/types";

/**
 * 
 * backend will guess wave height based on wind speed if no waveheight data available
 * 
 * @param startDate 
 * @param endDate 
 * @returns 
 */
export async function getPredictionRange(startDate: Date, endDate: Date): Promise<DayPrediction[]> {
  // TODO don't get more than 1 year
  const res = await fetch(`/api/prediction?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
  return res.json();
}