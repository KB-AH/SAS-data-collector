-- CreateTable
CREATE TABLE "Measurement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "device_id" INTEGER NOT NULL,
    "sensor_index" INTEGER NOT NULL,
    "sensor_value" INTEGER NOT NULL,
    "battery_value" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL
);
