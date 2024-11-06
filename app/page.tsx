"use client";
import { useEffect, useState } from "react";
import Calendar from 'react-calendar';
import RangeControls from "@/lib/components/RangeControls";
import YearSelector from "@/lib/components/YearSelector";
import { type DayPrediction } from "@/lib/types";
import 'react-calendar/dist/Calendar.css';
import NavButton from "@/lib/components/NavButton";

const CURR_YEAR = new Date().getFullYear();

const WHT_UB = 20;
const WPD_UB = 20;

const handleImportStationData = (importYearRange: [number, number], stationIdToImport?: string) => () => {
  const [startYear, endYear] = importYearRange;
  if (endYear < startYear) {
    alert('Can\'t complete import. End year must be greater than start year');
    return;
  }

  if (stationIdToImport) {
    console.log('Importing station data for stationId: ', stationIdToImport);
    fetch(`/api/import?startYear=${startYear}&endYear=${endYear}&stationId=${stationIdToImport}`)
    .then(async response => {
      if (response.ok) {
        alert(`Successfully imported data for station ID ${stationIdToImport} for year range ${startYear}-${endYear}`);
      } else {
        const errorBody = await response.json();
        throw new Error(`${response.statusText}: ${errorBody.error}`);
      }
    })
    .catch(e => {
      alert(`Error importing data for station ID ${stationIdToImport} for year range ${startYear}-${endYear}: ${e}`);
    });
  }
}


function debounce(fn: (e: any) => void, ms: number = 500) {
  let timeout: NodeJS.Timeout;
  return (e: any) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(e), ms);
  };
}

async function getDayPredictionsInRange(startDate: Date, endDate: Date, stationIds: string[]): Promise<DayPrediction[]> {
  // TODO what timezone does noaa use for dates?
  const response = await fetch(`/api?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&stationIds=${stationIds.join(',')}`);
  const data = await response.json();
  return data.data.map((d: DayPrediction) => ({...d, date: new Date(d.date)}));
}

function getDateKey(date: Date): string {
  return date.toDateString();
}

/**
 * Generates acceptability score for a given day's prediction.
 * if score is 10% out of max side of range, it will be "ok"
 * 
 * 0: bad, 1: ok, 2: good
 * 
 * @param prediction 
 * @param maxWaveHeight 
 * @param minWavePeriod 
 * @param maxWavePeriod 
 * @returns 
 */
function getScore(
  prediction: DayPrediction,
  acceptedMinWaveHeight: number,
  acceptedMaxWaveHeight: number,
  acceptedMinWavePeriod: number,
  acceptedMaxWavePeriod: number,
): number {
  const {
    waveHeight: predictedWaveHeight,
    wavePeriod,
  } = prediction;

  const minOkWht = acceptedMinWaveHeight * 0.9;
  const maxOkWht = acceptedMaxWaveHeight * 1.1;
  const minOkWpd = acceptedMinWavePeriod * 0.9;
  const maxOkWpd = acceptedMaxWavePeriod * 1.1;

  const waveHeight = predictedWaveHeight!;
  const waveHeightGood = waveHeight >= acceptedMinWaveHeight && waveHeight <= acceptedMaxWaveHeight;
  const wavePeriodGood = wavePeriod ? wavePeriod >= acceptedMinWavePeriod && wavePeriod <= acceptedMaxWavePeriod : true;

  // good
  if (waveHeightGood && wavePeriodGood) {
    return 2;
  }

  const waveHeightOk = waveHeight >= minOkWht && waveHeight <= maxOkWht;
  const wavePeriodOk = wavePeriod ? wavePeriod >= minOkWpd && wavePeriod <= maxOkWpd : true;
  // ok
  if (waveHeightOk && wavePeriodOk) {
    return 1;
  }

  // bad
  return 0;
}

// map from iso date string to acceptability score
// 0: bad, 1: ok, 2: good
type PredictionMap = Record<string, number>;

function makePredictionMap(predictions: DayPrediction[], waveHtRange: [number, number], wavePdRange: [number, number]): PredictionMap {
  return predictions.reduce((acc, prediction) => ({...acc, [getDateKey(prediction.date)]: getScore(
    prediction,
    waveHtRange[0],
    waveHtRange[1],
    wavePdRange[0],
    wavePdRange[1],
  )}), {});
}

// TODO debounce all range changes
async function fetchPredictions(
  view: string | 'month' | 'year' | 'day',
  activeStartDate: Date,
  stationIds: string[],
): Promise<DayPrediction[]> {
  // if day, fetch single day
  // if month, fetch month before and after
  // if year, fetch all days in year
  const msInDay = 24 * 60 * 60 * 1000;

  switch (view) {
    case 'day':
      return getDayPredictionsInRange(activeStartDate, activeStartDate, stationIds);
    case 'month':
      const currMs = activeStartDate.getTime();
      const monthStart = new Date(currMs - (40*msInDay));
      const monthEnd = new Date(currMs + (40*msInDay));
      return getDayPredictionsInRange(monthStart, monthEnd, stationIds);
    case 'year':
      // TODO year view will only show months, is it necessary to get all days?
      const year = activeStartDate.getFullYear();
      const startDateMs = new Date(year, 1, 0).getTime();
      const endDate = new Date(startDateMs + (365 * msInDay));
      return getDayPredictionsInRange(new Date(startDateMs), endDate, stationIds);
    default:
        return [];
  }
}

export default function Home() {
  const [waveHeightRange, setWaveHeightRange] = useState<[number, number]>([0, WHT_UB]);
  const [wavePeriodRange, setWavePeriodRange] = useState<[number, number]>([0, WPD_UB]);
  const [predictions, setDayPredictions] = useState<DayPrediction[]>([]);
  const [predictionMap, setDayPredictionsMap] = useState<Record<string, number>>({});
  const [calendarView, setCalendarView] = useState<{ view: string, activeStartDate: Date }>({view: 'month', activeStartDate: new Date()});
  const [stationIds, setStationIds] = useState<string[]>([]);
  const [stationIdToImport, setImportStationId] = useState<string | undefined>();
  const [importYearRange, setImportYearRange] = useState<[number, number]>([CURR_YEAR, CURR_YEAR]);
  const [selectedDateDetails, setSelectedDateDetails] = useState<DayPrediction | undefined>();
  const [activeTab, setActiveTab] = useState<'filters' | 'import'>('filters');

  useEffect(() => {
    fetchPredictions(calendarView.view, calendarView.activeStartDate, stationIds)
    .then(setDayPredictions)
    .catch(e => {
      console.error('Error fetching predictions while updating calendar view', e);
    });
  }, [calendarView, stationIds]);

  useEffect(() => {
    setDayPredictionsMap(makePredictionMap(predictions, waveHeightRange, wavePeriodRange));
  }, [waveHeightRange, wavePeriodRange, predictions]);

  const setStationIdHandler = debounce((e: any) => setStationIds(e.target.value.split(',').map((s: string) => s.trim())));

  const filterTab = (
    <>
      <RangeControls label="Wave Height Feet" range={waveHeightRange} setRange={setWaveHeightRange} lowerBound={0} upperBound={WHT_UB} />
      <RangeControls label="Wave Period Seconds" range={wavePeriodRange} setRange={setWavePeriodRange} lowerBound={0} upperBound={WPD_UB} />
      <YearSelector
        label="Year"
        value={calendarView.activeStartDate.getFullYear()}
        onChange={year => setCalendarView({
          view: calendarView.view,
          activeStartDate: new Date(year, calendarView.activeStartDate.getMonth(), calendarView.activeStartDate.getDate())
        })}
      />
      <div>
        <div>
          Station IDs (comma separated list)
        </div>
        <input
          className="border border-gray-300 rounded-md p-1 w-full"
          type="text"
          defaultValue={stationIds.join(',')}
          placeholder="Get IDs from NDBC Station map"
          onChange={setStationIdHandler}
        />
      </div>
    </>
  );

  const importTab = (
    <>
      <div className="flex space-x-8">
        <YearSelector
          label="Start Year"
          value={importYearRange[0]}
          onChange={year => setImportYearRange([year, importYearRange[1]])}
        />
        <YearSelector
          label="End Year"
          value={importYearRange[1]}
          onChange={year => setImportYearRange([importYearRange[0], year])}
        />
      </div>
      <div className="flex space-x-1">
        <input
          className="border border-gray-300 rounded-md p-1"
          type="text"
          placeholder="Enter station ID"
          onChange={e => setImportStationId(e.target.value)}
        />
        <input
          className="border border-gray-300 rounded-md p-1"
          type="submit"
          value="Import"
          onClick={handleImportStationData(importYearRange, stationIdToImport)}
        />
      </div>
    </>
  );

  return (
    <div className="p-4">
      <nav className="flex border-b border-gray-200 mb-4">
        <div>
          <NavButton tabKey="filters" activeTab={activeTab} setActiveTab={() => setActiveTab('filters')}>Filters</NavButton>
          <NavButton tabKey="import" activeTab={activeTab} setActiveTab={() => setActiveTab('import')}>Import Data</NavButton>
        </div>
        <div className="ml-auto">
          <a className="block text-blue-500" href="https://www.ndbc.noaa.gov/obs.shtml" target="_blank">National Data Buoy Center Station Map</a>
        </div>
      </nav>
      <div className="flex mb-8 space-x-8">{activeTab === 'filters' ? filterTab : importTab}</div>
      <div className="flex">
        <div className="flex-2">
          <Calendar
            onClickDay={date => {
              const key = getDateKey(date);
              if (selectedDateDetails && key === getDateKey(selectedDateDetails!.date)) {
                setSelectedDateDetails(undefined);
              } else {
                setSelectedDateDetails(predictions.find(p => getDateKey(p.date) === key));
              }
            }}
            activeStartDate={calendarView.activeStartDate}
            onActiveStartDateChange={({ view, activeStartDate }) => setCalendarView({view, activeStartDate: activeStartDate ?? new Date()})}
            onViewChange={({ view, activeStartDate }) => setCalendarView({view, activeStartDate: activeStartDate ?? new Date()})}
            tileClassName={({ date }) => {
              switch (predictionMap[getDateKey(date)]) {
                case 2:
                  return 'good';
                case 1:
                  return 'ok';
                case 0:
                  return 'bad';
                default:
                  return;
              }
            }}
          />
        </div>
        <div className="ml-4 flex-1 border border-gray-300 rounded-md p-4">
          {selectedDateDetails ? (
            <div>
              {Object.entries(selectedDateDetails).map(([key, value]) => (
                <div key={key} className="mb-2">
                  <span className="font-semibold">{key}: </span>
                  <span>{value instanceof Date ? value.toLocaleDateString() : JSON.stringify(value)}</span>
                </div>
              ))}
            </div>
          ) : 'no details selected'}
        </div>
      </div>
    </div>
  );
}