import fs from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { type WeatherSensorSample } from '@prisma/client';
import { prisma } from '@/lib/prediction/client';
import { handleFetch } from '@/lib/fetchUtil';

const DEFAULT_STATION_ID = '41002';

async function* processGzFile(filepath: string): AsyncGenerator<string> {
  const fileStream = fs.createReadStream(filepath);
  const unzipStream = createGunzip();
  const rl = createInterface({
    input: fileStream.pipe(unzipStream),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    yield line;
  }
}

// https://www.ndbc.noaa.gov/historical_data.shtml for 41002 weather station
// returns file path
async function downloadNoaaFile(year: number, buoyStationId: string = DEFAULT_STATION_ID): Promise<string> {
  const compressedFn = `${buoyStationId}h${year}.txt.gz`;
  const compressedUrl = `https://www.ndbc.noaa.gov/data/historical/stdmet/${compressedFn}`;

  return handleFetch<ReadableStream<Uint8Array>>(compressedUrl, {
    "headers": {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    },
  }, false, false, true)
  .then(async body => {
    if (body) {
      // Create or truncate the file before writing chunks
      const path = `/tmp/${compressedFn}`;
      try {
        fs.writeFileSync(path, '');
       
        // at time of writing, body is a ReadableStream<Uint8Array> and should implement the AsyncIterable protocol
        for await (const chunk of body as any) {
          // Append each chunk to the file
          fs.appendFileSync(path, chunk);
        }
        return path;
      } catch (e) {
        console.error('Error writing file to path: ', path, '. Removing temp file: ', e);
        fs.unlinkSync(path);
      }
    }
    throw new Error(`No file found for year: ${year}, for station: ${buoyStationId}`);
  });
}

async function* parseNoaaFile(stationId: string, path: string): AsyncGenerator<WeatherSensorSample> {
  let index = 0;
  let headers: string[] = [];
  // maps header name to index
  let headerMap: Record<string, number> = {};
  for await (const line of processGzFile(path)) {
    if (index === 0) {
      headers = line.split(' ').map(h => h.trim()).filter(h => h !== '');
      // check to see if first row is headers
      if (!Number.isNaN(Number(headers[0]))) {
        console.error('Can\'t parse this csv because there are no headers. ', headers[0], ' should be a string');
        return;
      }

      headerMap = Object.fromEntries(headers.map(h => h.trim()).map((h, i) => [h, i]));
    }

    // skip the second row
    if (index > 1) {
      const items = line.split(' ').map((n: string) => {
        const parsed = Number(n.trim())
        if (isNaN(parsed)) {
          return null;
        }
        return parsed
      });

      const hours = items[headerMap['hh']] ?? 0;
      const minutes = items[headerMap['mm']] ?? 0;

      const date = new Date(
        items[headerMap['#YY']]!,
        items[headerMap['MM']]! - 1,
        items[headerMap['DD']]!,
        hours,
        minutes,
        0
      );

      // optional values
      const windSpeedMs = items[headerMap['WSPD']];
      const airTemperatureC = items[headerMap['ATMP']];
      const windDirectionDegrees = items[headerMap['WDIR']];
      const gustSpeedMs = items[headerMap['GST']];
      const waveHeightM = items[headerMap['WVHT']];
      const dominantWavePeriodS = items[headerMap['DPD']];
      const averageWavePeriodS = items[headerMap['APD']];
      const dominantPeriodWaveDirectionDegrees = items[headerMap['MWD']];
      const airPressureHPa = items[headerMap['PRES']];
      const waterTemperatureC = items[headerMap['WTMP']];
      const dewPointC = items[headerMap['DEWP']];
      const visibilityNm = items[headerMap['VIS']];
      const tideHeightFt = items[headerMap['TIDE']];    

      const sample: WeatherSensorSample = {
          date,
          stationId,
          windSpeedMs,
          airTemperatureC,
          windDirectionDegrees,
          gustSpeedMs,
          waveHeightM,
          dominantWavePeriodS,
          averageWavePeriodS,
          dominantPeriodWaveDirectionDegrees,
          airPressureHPa,
          waterTemperatureC,
          dewPointC,
          visibilityNm,
          tideHeightFt,    
      };
      yield sample;
    }

    index++;
  }
}

async function upsertSamples(samples: WeatherSensorSample[], buoyStationId: string) {
  try {
    let seenDates: Set<string> = new Set();
    const deduped: WeatherSensorSample[] = [];
    for (const sample of samples) {
      if (!seenDates.has(sample.date.toISOString())) {
        deduped.push(sample);
      }
      seenDates.add(sample.date.toISOString());
    }
    return prisma.$transaction([
      prisma.weatherSensorSample.deleteMany({
        where: {
          stationId: buoyStationId,
          date: { in: Array.from(seenDates) },
        },
      }),
      prisma.weatherSensorSample.createMany({data: deduped}),
    ]);
  } catch (e) {
    console.error('Error adding data for samples. total samples: ', samples.length, ', for station: ', buoyStationId, e);
  }
}

export async function saveDataDb(yearStart: number, yearEnd: number | null = null, buoyStationId: string = DEFAULT_STATION_ID) {
  const upsertBatchSize = 5000;
  try {
    for (let year = yearStart; year < (yearEnd ?? yearStart + 1); year++) {
      let file = '';
      const downloadStart = Date.now();
      try {
        console.log('Starting to download file for year: ', year, ', for station: ', buoyStationId);
        file = await downloadNoaaFile(year, buoyStationId)
        const downloadEnd = Date.now();
        console.log('Downloaded file for year: ', year, ', for station: ', buoyStationId, ', in: ', downloadEnd - downloadStart, 'ms');
        console.log('Starting to parse file for year: ', year, ', for station: ', buoyStationId);
        const parseStart = Date.now();

        let samples: WeatherSensorSample[] = [];
        for await (const sample of parseNoaaFile(buoyStationId, file)) {
          samples.push(sample);

          if (samples.length > upsertBatchSize) {
            await upsertSamples(samples, buoyStationId)
            samples = [];
          }
        }

        if (samples.length) {
          await upsertSamples(samples, buoyStationId)
          samples = [];
        }

        const parseEnd = Date.now();
        console.log('Parsed file for year: ', year, ', for station: ', buoyStationId, ', in: ', parseEnd - parseStart, 'ms');
      } catch (e) {
        console.error('Error adding data for year: ', year, ', for station: ', buoyStationId, e);
      } finally {
        if (file) {
          // remove the temp file
          fs.unlinkSync(file);
        }
      }
    }
  } catch (e) {
    console.error('Error saving data to db: ', e);
  }
}

//export function saveDataFile(year: number, buoyStationId: string = DEFAULT_STATION_ID, path: string = '/Users/niole.nelson/noaa_test/ship-weather/') {
//  const fn = `${buoyStationId}h${year}.txt`;
//  downloadNoaaFile(year, buoyStationId)
//    .then(content => {
//        fs.writeFile(`${path}${fn}`, content, (err: any) => {
//            if (err) {
//                    console.error(err);
//            } else {
//                console.log('wrote file: ', fn);
//            }
//        })
//    });
//}