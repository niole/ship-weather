"use client";
import 'react-calendar/dist/Calendar.css';
import { useEffect, useRef, useState } from "react";
import Calendar from 'react-calendar';
import RangeControls from "@/lib/components/RangeControls";
import YearSelector from "@/lib/components/YearSelector";
import { type DayPrediction } from "@/lib/types";
import NavButton from "@/lib/components/NavButton";
import { handleFetch } from '@/lib/fetchUtil';

const CURR_YEAR = new Date().getFullYear();

const WHT_UB = 20;
const WPD_UB = 1100;



function debounce(fn: (e: any) => void, ms: number = 500) {
  let timeout: NodeJS.Timeout;
  return (e: any) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(e), ms);
  };
}

async function getDayPredictionsInRange(startDate: Date, endDate: Date, stationIds: string[], percentile: number): Promise<DayPrediction[]> {
  try {
    const data = await handleFetch<{ data: DayPrediction[] }>(`/api?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&stationIds=${stationIds.join(',')}&percentile=${percentile/100}`);
    return data.data.map((d: DayPrediction) => ({...d, date: new Date(d.date)}));
  } catch (e) {
    const message = `Failed to get data for ${stationIds.join(', ')}`;
    console.error(message, e);
    return [];
  }
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

type PredictionWithScore = DayPrediction & { score: number };

// map from iso date string to acceptability score
// 0: bad, 1: ok, 2: good
type PredictionMap = Record<string, PredictionWithScore>;

function makePredictionMap(predictions: DayPrediction[], waveHtRange: [number, number], wavePdRange: [number, number]): PredictionMap {
  return predictions.reduce((acc, prediction) => ({...acc, [getDateKey(prediction.date)]: {
    score: getScore(
      prediction,
      waveHtRange[0],
      waveHtRange[1],
      wavePdRange[0],
      wavePdRange[1],
    ),
    ...prediction,
  }}), {});
}

// TODO debounce all range changes
async function fetchPredictions(
  view: string | 'month' | 'year' | 'day',
  activeStartDate: Date,
  stationIds: string[],
  percentile: number,
): Promise<DayPrediction[]> {
  // if day, fetch single day
  // if month, fetch month before and after
  // if year, fetch all days in year
  const msInDay = 24 * 60 * 60 * 1000;

  switch (view) {
    case 'day':
      return getDayPredictionsInRange(activeStartDate, activeStartDate, stationIds, percentile);
    case 'month':
      const currMs = activeStartDate.getTime();
      const monthStart = new Date(currMs - (40*msInDay));
      const monthEnd = new Date(currMs + (40*msInDay));
      return getDayPredictionsInRange(monthStart, monthEnd, stationIds, percentile);
    case 'year':
      // TODO year view will only show months, is it necessary to get all days?
      const year = activeStartDate.getFullYear();
      const startDateMs = new Date(year, 1, 0).getTime();
      const endDate = new Date(startDateMs + (365 * msInDay));
      return getDayPredictionsInRange(new Date(startDateMs), endDate, stationIds, percentile);
    default:
        return [];
  }
}

export default function Home() {
  const [waveHeightRange, setWaveHeightRange] = useState<[number, number]>([0, WHT_UB]);
  const [wavePeriodRange, setWavePeriodRange] = useState<[number, number]>([0, WPD_UB]);
  const [predictions, setDayPredictions] = useState<DayPrediction[]>([]);
  const [predictionMap, setDayPredictionsMap] = useState<PredictionMap>({});
  const [calendarView, setCalendarView] = useState<{ view: string, activeStartDate: Date }>({view: 'month', activeStartDate: new Date()});
  const [stationIds, setStationIds] = useState<string[]>([]);
  const [stationIdToImport, setImportStationId] = useState<string | undefined>();
  const [importYearRange, setImportYearRange] = useState<[number, number]>([CURR_YEAR-1, CURR_YEAR]);
  const [selectedDateDetails, setSelectedDateDetails] = useState<PredictionWithScore | undefined>();
  const [activeTab, setActiveTab] = useState<'filters' | 'import'>('filters');
  const [percentileRange, setPercentileRange] = useState<[number, number]>([0, 95]);
  const [isImporting, setIsImporting] = useState(false);
  const importAbortControllerRef = useRef<AbortController>();

  useEffect(() => {
    fetchPredictions(calendarView.view, calendarView.activeStartDate, stationIds, percentileRange[1])
    .then(p => {
      setDayPredictions(p);
      setSelectedDateDetails(undefined);
    })
    .catch(e => {
      console.error('Error fetching predictions while updating calendar view', e);
    });
  }, [calendarView, stationIds, percentileRange]);

  const handleImportStationData = (importYearRange: [number, number], stationIdToImport?: string) => () => {
    const [startYear, endYear] = importYearRange;
    if (endYear <= startYear) {
      alert('Can\'t complete import. End year must be greater than start year');
      return;
    }

    if (endYear - startYear > 5) {
      alert('Please import less than 5 years of data at a time.');
      return;
    }

    if (isImporting) {
      const shouldCancel = confirm('Import already in progress. Cancel?');
      if (shouldCancel) {
        importAbortControllerRef.current?.abort('User cancelled import');
        setIsImporting(false);
        return;
      }
    }

    if (stationIdToImport) {
      setIsImporting(true);

      importAbortControllerRef.current = new AbortController();

      console.log('Importing station data for stationId: ', stationIdToImport);

      handleFetch(`/api/import?startYear=${startYear}&endYear=${endYear}&stationId=${stationIdToImport}`, {
        signal: importAbortControllerRef.current?.signal,
      })
      .then(() => {
        alert(`Successfully imported data for station ID ${stationIdToImport} for year range ${startYear}-${endYear}`);
      })
      .catch(e => {
        alert(`Error importing data for station ID ${stationIdToImport} for year range ${startYear}-${endYear}: ${e}`);
      })
      .finally(() => {
        setIsImporting(false);
      });
    }
  }

  useEffect(() => {
    setDayPredictionsMap(makePredictionMap(predictions, waveHeightRange, wavePeriodRange));
  }, [waveHeightRange, wavePeriodRange, predictions]);

  const setStationIdHandler = debounce((e: any) => setStationIds(e.target.value.split(',').map((s: string) => s.trim())));

  const missingWavePeriodData = predictions.length > 0 ? !!predictions.find(p => p.wavePeriod === null || p.wavePeriod === undefined) : false;

  const filterTab = (
    <>
      <RangeControls label="Wave Height Feet" range={waveHeightRange} setRange={setWaveHeightRange} lowerBound={0} upperBound={WHT_UB} onlyMax={true} />
      <div>
        <RangeControls label="Wave Period Seconds" range={wavePeriodRange} setRange={setWavePeriodRange} lowerBound={0} upperBound={WPD_UB} onlyMax={true} />
        {missingWavePeriodData && <div className="text-orange-500">Days with orange dots don't include wave period data</div>}
      </div>
      <RangeControls label="Percentile" range={percentileRange} setRange={setPercentileRange} lowerBound={0} upperBound={100} onlyMax={true} />
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
          Selected Stations (comma separated list)
        </div>
        <input
          className="border border-gray-300 rounded-md p-1 w-full"
          type="text"
          defaultValue={stationIds.join(',')}
          placeholder="Get IDs from NDBC Station Map"
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
        <button
          className="border border-gray-300 rounded-md p-1 min-w-[80px] disabled:opacity-50"
          onClick={handleImportStationData(importYearRange, stationIdToImport)}
        >
          {isImporting ? (
            <span className="inline-block animate-spin">⟳</span>
          ) : 'Import'}
        </button>
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
          <a 
            className="block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors" 
            href="https://www.ndbc.noaa.gov" 
            target="_blank"
          >
            National Data Buoy Center Station Map
          </a>
        </div>
      </nav>
      <div className="flex mb-8 space-x-8">{activeTab === 'filters' ? filterTab : importTab}</div>
      <div className="text-orange-500 text-center pb-4">{predictions.length === 0 ? "No data found. Pick another date range or station." : ""}</div>
      <div>
        <Calendar
          className="!w-full md:!w-2/3 lg:!w-2/3 inline-block align-top"
          onClickDay={date => {
            const key = getDateKey(date);
            if (selectedDateDetails && key === getDateKey(selectedDateDetails!.date)) {
              setSelectedDateDetails(undefined);
            } else {
              setSelectedDateDetails(predictionMap[key]);
            }
          }}
          activeStartDate={calendarView.activeStartDate}
          onActiveStartDateChange={({ view, activeStartDate }) => setCalendarView({view, activeStartDate: activeStartDate ?? new Date()})}
          onViewChange={({ view, activeStartDate }) => setCalendarView({view, activeStartDate: activeStartDate ?? new Date()})}
          tileClassName={({ date }) => {
            switch (predictionMap[getDateKey(date)]?.score) {
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
          tileContent={({ date }) => {
            const prediction = predictionMap[getDateKey(date)];
            if (prediction) {
              const { wavePeriod } = prediction;
              if (wavePeriod === null || wavePeriod === undefined) {
                return <div className="w-2 h-2 rounded-full bg-orange-500 mx-auto mt-1"></div>;
              }
            }
          }}
        />
        {selectedDateDetails ? (
          <div className="w-full md:w-1/4 lg:w-1/4 inline-block text-wrap break-all">
            <button
              title="clear"
              onClick={() => setSelectedDateDetails(undefined)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
            {Object.entries(selectedDateDetails).map(([key, value]) => (
              <div key={key} className="mb-2">
                <span className="font-semibold">{key}: </span>
                <span className="text-wrap">{value instanceof Date ? value.toLocaleDateString() : JSON.stringify(value)}</span>
              </div>
            ))}
          </div>
        ) : <span className="ml-4">no details selected</span>}
      </div>
    </div>
  );
}