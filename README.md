# Plan

measurement descriptions for noaa data https://www.ndbc.noaa.gov/faq/measdes.shtml
la push fishing area: https://wdfw.maps.arcgis.com/home/webmap/viewer.html?webmap=f415cd6cb2f14a8ab14d9c0bcd2cb429&extent=-126,47.53817114,-124.320018352,48.164183106

lamont cares about yoy data. certain wave height to wave distance ratios don't work for his boat.

based on wave height and average wave period, figure out if the waves will work for his boat.

his boat is 25' long and 12k lbs

wavelength = speed of wave / frequency
wavelength = WDSP(m/s) / (1 wave/APD (s)) 
wavelength = WDSP m/s * APD (s/wave) = m/wave  = WDSP * APD

waves will work for his boat if the wavelength is <= his boat length
WDSP * APD <= 25'*.3048 = 7.62m

I think I don't know the relationship between wave height, distance, that works for his boat.

For each day and year, let user pick a year and show predictions.

The point of this app is to help a boat charter captain pick a good day to take people out. It's probably better to lean towards 'pleasure cruise' type weather.
Some boaters don't have a good sense of what weather conditions their boat can handle.

often we don't have wht or wpd data. We always have wind speed, air pressure, temperature, humidity
- low pressure == stormy
- warm sea temp / higher humidity == rainy
- high wind speed == stormy
- high temp diff between air and sea == unstable ocean

# UX

- Integrate some real data
- let user pick a range of dates by clicking and dragging on the calendar and getting an alert with the date range
- make UI look nice

# Questions

- what are the appropriate whts and wpds for different boats? Are multiple distinct ranges possible?
- can we recommend previous years to examine?
- what ranges for basic meteorological data indicate calm vs stormy conditions?

# Seeding

Seed data from the National Data Buoy Center by specifying a range of years and a station ID.

```sh
npx ts-node
```

```js
let c = require('./getData.ts');
// station ID is lower case
c.saveDataDb(2020, 2024, 'lapw1');
```
