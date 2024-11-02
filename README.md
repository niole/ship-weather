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


# UX

- Integrate some real data
- let user pick a range of dates by clicking and dragging on the calendar and getting an alert with the date range
- make UI look nice

# Questions

- what are the appropriate whts and wpds for different boats? Are multiple distinct ranges possible?
- can we recommend previous years to examine?