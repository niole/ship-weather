const fs = require('node:fs');

// https://www.ndbc.noaa.gov/historical_data.shtml for 41002 weather station

module.exports = {
    getData: function getData(year) {
    const fn = `41002h${year}.txt`;
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
};
