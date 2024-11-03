import { type DayPrediction } from "@/lib/types";

function getData(year, buoyStationId = '41002') {
    const fn = `${buoyStationId}h${year}.txt`;
    fetch(`https://www.ndbc.noaa.gov/view_text_file.php?filename=${fn}.gz&dir=data/historical/stdmet/`)
        .then(response => response.text())
        .then(content => {
            fs.writeFile(`/Users/niole.nelson/noaa_test/data/${fn}`, content, err => {
                if (err) {
                        console.error(err);
                } else {
                    console.log('wrote file: ', fn);
                }
            })
        });

}

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