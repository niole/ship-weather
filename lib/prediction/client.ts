import { type DayPrediction } from "@/lib/types";
import { WeatherSensorSample, PrismaClient } from '@prisma/client';

// Create a singleton instance
declare global {
  var prisma: PrismaClient | undefined;
}
export const prisma = global.prisma || new PrismaClient();

// In development, save the instance to global to prevent multiple instances during hot reloading
if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

function castNonsenseToNull(v: number | undefined | null): number | null {
  if (v === 9999 || v === 999 || v === 99 || v === undefined || v === null) {
    return null;
  }
  return v;
}

function getBeaufortWhtPredictionFt(windSpeedKts: number): number {
  // based off of https://www.wpc.ncep.noaa.gov/html/beaufort.shtml
  if (windSpeedKts <= 3) {
    return 0.25;
  }

  if (windSpeedKts <= 6) {
    return 1;
  }

  if (windSpeedKts <= 10) {
    return 3;
  }

  if (windSpeedKts <= 16) {
    return 5;
  }

  if (windSpeedKts <= 21) {
    return 8;
  }

  if (windSpeedKts <= 27) {
    return 13;
  }

  // near gale
  if (windSpeedKts <= 33) {
    return 19;
  }

  return Infinity;
}

/**
 * Gets weather sensor samples between two dates
 */
async function getWeatherSensorSamples(startDate: Date, endDate: Date, stationIds: string[]): Promise<WeatherSensorSample[]> {
  return prisma.weatherSensorSample.findMany({
    where: {
      windSpeedMs: { not: null },
      stationId: { in: stationIds },
      date: {
        gte: startDate,
        lte: endDate,
      }
    },
    orderBy: {
      date: 'asc'
    }
  });
}

function msToKts(ms: number): number {
  return ms * 1.9438444924405793;
}

function mToFt(m: number | undefined | null): number | undefined {
  if (m === undefined || m === null) {
    return;
  }
  return m * 3.28084;
}

/**
 * 
 * backend will guess wave height based on wind speed if no waveheight data available
 * averages each metric over the day
 * won't get more than 1 year of data
 * won't get data if startDate is after endDate
 * 
 * @param startDate 
 * @param endDate 
 * @param stationIds Ids of National Data Buoy Center stations, must be lowercase, https://www.ndbc.noaa.gov/obs.shtml
 * @returns  Predictions of ocean metrics aggregated by day during specified range for stations
 */
export async function getDayPredictionsInRange(startDate: Date, endDate: Date, stationIds: string[]): Promise<DayPrediction[]> {
    if (endDate < startDate) {
        console.error('Can\'t get day predictions. endDate must be greater than startDate. endDate:', endDate, 'startDate:', startDate);
        return [];
    }

    if (endDate.getTime() - startDate.getTime() > 365 * 24 * 60 * 60 * 1000) {
        console.error('Can\'t get day predictions. Date tange is greater than 1 year. startDate:', startDate, 'endDate:', endDate);
        return [];
    }

    const samples = await getWeatherSensorSamples(startDate, endDate, stationIds);

    // must always have windspeed
    // sometimes the data coming in is nonsense, like 9999 or 99, so we cast those to null
    const groupedSamples = samples
    .filter(s => castNonsenseToNull(s.windSpeedMs!) !== null)
    .map(sample => {
        const windSpeedKts = msToKts(sample.windSpeedMs!);
        const waveHeight = mToFt(castNonsenseToNull(sample.waveHeightM)) ?? getBeaufortWhtPredictionFt(windSpeedKts);
        const wavePeriod = castNonsenseToNull(sample.averageWavePeriodS) ?? undefined;

        // TODO
        const weatherInstability = 0;

        return {
            date: sample.date,
            windSpeedKts,
            waveHeight,
            wavePeriod,
            weatherInstability,
            rawData: [sample],
        };
    })
    // group by day
    .reduce((acc: Record<string, DayPrediction[]>, s) => {
        const date = s.date.toDateString();
        acc[date] = (acc[date] ?? [])
        acc[date].push(s);
        return acc;
    }, {});

    // average each metric, leave raw data alone
    // each day predictions should be at least 1 day of data
    return Object.values(groupedSamples).map(dayPredictions => {
        const metrics = dayPredictions.reduce((acc, s) => {
            acc.windSpeedKts += s.windSpeedKts;
            if (s.waveHeight) {
                acc.waveHeight += s.waveHeight;
                acc.totalWaveHeightSamples++;
            }

            if (s.wavePeriod) {
                acc.wavePeriod += s.wavePeriod;
                acc.totalWavePeriodSamples++;
            }

            // TODO
            acc.weatherInstability += s.weatherInstability ?? 0;

            return acc
        }, {
            windSpeedKts: 0,
            waveHeight: 0,
            totalWaveHeightSamples: 0,
            wavePeriod: 0,
            totalWavePeriodSamples: 0,
            weatherInstability: 0,
        });

        return {
            date: dayPredictions[0].date,
            windSpeedKts: metrics.windSpeedKts / dayPredictions.length,
            waveHeight: metrics.waveHeight / metrics.totalWaveHeightSamples,
            wavePeriod: metrics.wavePeriod / metrics.totalWavePeriodSamples,
            weatherInstability: metrics.weatherInstability / dayPredictions.length,
            rawData: dayPredictions.map(p => p.rawData ? p.rawData[0] : null).filter(x => x !== null),
        };
    });


}