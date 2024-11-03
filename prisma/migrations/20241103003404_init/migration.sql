-- CreateTable
CREATE TABLE "WeatherSensorSample" (
    "date" DATETIME NOT NULL,
    "stationId" TEXT NOT NULL,
    "windSpeedMs" REAL,
    "airTemperatureC" REAL,
    "windDirectionDegrees" REAL,
    "gustSpeedMs" REAL,
    "waveHeightM" REAL,
    "dominantWavePeriodS" REAL,
    "averageWavePeriodS" REAL,
    "dominantPeriodWaveDirectionDegrees" REAL,
    "airPressureHPa" REAL,
    "waterTemperatureC" REAL,
    "dewPointC" REAL,
    "visibilityNm" REAL,
    "tideHeightFt" REAL,

    PRIMARY KEY ("date", "stationId")
);
