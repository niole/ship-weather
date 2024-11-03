const fs = require('node:fs');
const { WeatherSensorSample, PrismaClient } = require('@prisma/client');

const DEFAULT_STATION_ID = '41002'

// https://www.ndbc.noaa.gov/historical_data.shtml for 41002 weather station

async function getNoaaFile(year: number, buoyStationId: string = DEFAULT_STATION_ID): Promise<string> {
  const fn = `${buoyStationId}h${year}.txt`;
  return fetch(`https://www.ndbc.noaa.gov/view_text_file.php?filename=${fn}.gz&dir=data/historical/stdmet/`)
    .then(response => response.text())
    .catch(err => {
      console.error('Failed to fetch NOAA file for file: ', fn, err);
      return '';
    })
}

function parseNoaaFile(stationId: string, csvString: string): typeof WeatherSensorSample[] {
  const rows = csvString.trim().split('\n').map(r => r.trim());
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].split(' ');

  // check to see if first row is headers
  if (!Number.isNaN(Number(headers[0]))) {
    console.error('Can\'t parse this csv because there are no headers. ', headers[0], ' should be a string');
    return [];
  }

  // maps header name to index
  const headerMap = Object.fromEntries(headers.map(h => h.trim()).map((h, i) => [h, i]));

  return rows.slice(2).map(r => {
    const items = r.split(' ').map(n => {
      const parsed =Number(n.trim())
      if (isNaN(parsed)) {
        return null;
      }
      return parsed
  });
    const hours = items[headerMap['hh']] ?? 0;
    const minutes = items[headerMap['mm']] ?? 0;

    const date = new Date(
      items[headerMap['#YY']]!,
      items[headerMap['MM']]!,
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

    return {
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
  });
}

async function saveDataDb(yearStart: number, yearEnd: number | null = null, buoyStationId: string = DEFAULT_STATION_ID) {
  const prisma = new PrismaClient()
  try {
    for (let year = yearStart; year <= (yearEnd ?? yearStart + 1); year++) {
      const file = await getNoaaFile(year, buoyStationId)
      const samples = parseNoaaFile(buoyStationId, file)

      // TODO do bulk calls someday
      await prisma.$transaction(
        samples.forEach((sample) =>
          prisma.weatherSensorSample.upsert({
            where: {
              date_stationId: {
                date: sample.date,
                stationId: sample.stationId,
              },
            },
            create: sample,
            update: sample,
          })
        )
      );
    }
  } catch (e) {
    console.error('Error saving data to db: ', e);
  } finally {
    await prisma.$disconnect()
  }
}

function saveDataFile(year: number, buoyStationId: string = DEFAULT_STATION_ID, path: string = '/Users/niole.nelson/noaa_test/ship-weather/') {
  const fn = `${buoyStationId}h${year}.txt`;
  getNoaaFile(year, buoyStationId)
    .then(content => {
        fs.writeFile(`${path}${fn}`, content, (err: any) => {
            if (err) {
                    console.error(err);
            } else {
                console.log('wrote file: ', fn);
            }
        })
    });
}

module.exports = {
  saveDataFile,
  saveDataDb,
};