"use client";
import { useEffect, useState } from "react";
import Calendar from 'react-calendar';
import RangeControls from "@/lib/components/RangeControls";
import { type DayPrediction } from "@/lib/types";
import 'react-calendar/dist/Calendar.css';

const CURR_YEAR = new Date().getFullYear();

const WHT_UB = 20;
const WPD_UB = 20;

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
  const [stationIds, setStationIds] = useState<string[]>(['lapw1', 'desw1']);

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

  return (
    <div className="p-4">
      <div className="flex">
        <RangeControls label="Wave Height Feet" range={waveHeightRange} setRange={setWaveHeightRange} lowerBound={0} upperBound={WHT_UB} />
        <RangeControls label="Wave Period Seconds" range={wavePeriodRange} setRange={setWavePeriodRange} lowerBound={0} upperBound={WPD_UB} />
      </div>
      <div className="mb-6 flex">
        <div className="flex-1">
          <div>
            Year:
          </div>
          <select
            value={calendarView.activeStartDate.getFullYear()}
            onChange={(e) => setCalendarView({
            view: calendarView.view, 
            activeStartDate: new Date(Number(e.target.value), calendarView.activeStartDate.getMonth(), calendarView.activeStartDate.getDate())})}
          >
          {Array(60).fill(0).map((_, i) => 
            <option key={CURR_YEAR - i} value={CURR_YEAR - i}>{CURR_YEAR - i}</option>
            )}
          </select>
        </div>
        <div className="flex-1">
          <div>
            Station: <a className="text-blue-500" href="https://www.ndbc.noaa.gov/obs.shtml" target="_blank">National Data Buoy Center Station Map</a>
          </div>
          <input
            className="border border-gray-300 rounded-md p-1"
            type="text"
            defaultValue={stationIds.join(',')}
            onChange={setStationIdHandler}
          />
        </div>
      </div>
      <Calendar
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
  );
}