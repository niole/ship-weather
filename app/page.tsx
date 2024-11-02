"use client";
import { act, useEffect, useState } from "react";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

type DayPrediction = {
  date: Date;
  waveHeight: number;
  wavePeriod: number;
};

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
  acceptedMaxWavePeriod: number): number {
  const {
    waveHeight,
    wavePeriod,
  } = prediction;

  const minOkWht = acceptedMinWaveHeight * 0.9;
  const maxOkWht = acceptedMaxWaveHeight * 1.1;
  const minOkWpd = acceptedMinWavePeriod * 0.9;
  const maxOkWpd = acceptedMaxWavePeriod * 1.1;

  // good
  if (waveHeight >= acceptedMinWaveHeight && waveHeight <= acceptedMaxWaveHeight && wavePeriod >= acceptedMinWavePeriod && wavePeriod <= acceptedMaxWavePeriod) {
    return 2;
  }

  // ok
  if (waveHeight >= minOkWht && waveHeight <= maxOkWht && wavePeriod >= minOkWpd && wavePeriod <= maxOkWpd) {
    return 1;
  }

  // bad
  return 0;
}

// map from iso date string to acceptability score
// 0: bad, 1: ok, 2: good
type PredictionMap = Record<string, number>;

// TODO debounce all range changes
function fetchPredictions(
  view: string | 'month' | 'year' | 'day',
  activeStartDate: Date,
  waveHtRange: [number, number],
  wavePdRange: [number, number],
):  PredictionMap {
  // if day, fetch single day
  // if month, fetch month before and after
  // if year, fetch all days in year
  const msInDay = 24 * 60 * 60 * 1000;

  const dates: Date[] = (() => {
    switch (view) {
      case 'day':
        return [activeStartDate];
      case 'month':
      const currMs = activeStartDate.getTime();
        // in prevDays, skips the 0 offset so as to not duplicate the current day
        const prevDays = Array(31).fill(0).map((_, i) => new Date(currMs - ((i+1) * msInDay)));
        const nextDays = Array(31).fill(0).map((_, i) => new Date(currMs + (i * msInDay)));
        return [...prevDays, ...nextDays];
      case 'year':
        // TODO year view will only show months, is it necessary to get all days?
        const year = activeStartDate.getFullYear();
        const startDateMs = new Date(year, 1, 0).getTime();
        return Array(365).fill(0).map((_, i) => new Date(startDateMs + (i * msInDay)));
      default:
          return [];
    }})();

    return dates.reduce((acc, date) => ({...acc, [getDateKey(date)]: getScore(
        { date, waveHeight: Math.round(Math.random() * 10), wavePeriod: Math.round(Math.random() * 10) },
        waveHtRange[0],
        waveHtRange[1],
        wavePdRange[0],
        wavePdRange[1],
      )
    }), {});

}

export default function Home() {
  const [waveHeightRange, setWaveHeightRange] = useState<[number, number]>([3, 10]); // Default 3-10 feet
  const [wavePeriodRange, setWavePeriodRange] = useState<[number, number]>([1, 8]); // Default 8 seconds
  const [minWavePeriod, maxWavePeriod] = wavePeriodRange;
  const [predictionMap, setDayPredictions] = useState<Record<string, number>>({});
  const [calendarView, setCalendarView] = useState<{ view: string, activeStartDate: Date }>({view: 'month', activeStartDate: new Date()});

  useEffect(() => {
    const predictionMap = fetchPredictions(calendarView.view, calendarView.activeStartDate, waveHeightRange, wavePeriodRange);
    setDayPredictions(predictionMap);
  }, [waveHeightRange, wavePeriodRange, calendarView]);

  return (
    <div className="p-4">
      <div className="mb-6 flex">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">
            Min Wave Height: {waveHeightRange[0]} ft
          </label>
          <input
            type="range"
            min="0"
            max="20"
            value={waveHeightRange[0]}
            onChange={(e) => setWaveHeightRange([Number(e.target.value), waveHeightRange[1]])}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">
            Max Wave Height: {waveHeightRange[1]} ft
          </label>
          <input
            type="range"
            min="0"
            max="20"
            value={waveHeightRange[1]}
            onChange={(e) => setWaveHeightRange([waveHeightRange[0], Number(e.target.value)])}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      <div className="mb-6 flex">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">
            Min Wave Period: {minWavePeriod} seconds
          </label>
          <input type="range"
            min="4"
            max="20"
            value={minWavePeriod}
            onChange={(e) => setWavePeriodRange([Number(e.target.value), wavePeriodRange[1]])}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div className="flex-1 ml-4">
          <label className="block text-sm font-medium mb-2">
            Wave Period: {maxWavePeriod} seconds
          </label>
          <input
            type="range"
            min="4"
            max="20"
            value={maxWavePeriod}
            onChange={(e) => setWavePeriodRange([wavePeriodRange[0], Number(e.target.value)])}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
      <Calendar
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
