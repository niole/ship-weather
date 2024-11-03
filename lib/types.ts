export type DayPrediction = {
  date: Date;
  windSpeedKts: number;
  waveHeight?: number;
  wavePeriod?: number;
  weatherInstability?: number; // 1-3, 1 is pleasant, 2 is unpleasant, 3 is stormy
  rawData?: Record<string, number>;
  //windSpeedMs: number;
  //airTempC?: number;
  //airPressureHPa?: number;
  //dewPointC?: number;
  //gustSpeedMs?: number;
  //seaTempC?: number;
  //waveHeightFt?: number;
  //averageWavePeriodSeconds?: number;
  //dominoantWavePeriodSeconds?: number;
};