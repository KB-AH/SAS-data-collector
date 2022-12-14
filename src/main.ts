import { SerialPortStream } from "@serialport/stream";
import { ReadlineParser } from "@serialport/parser-readline";
import { autoDetect } from "@serialport/bindings-cpp";
const binding = autoDetect();
import {
  share,
  tap,
  Observable,
  buffer,
  filter,
  pairwise,
  map,
  interval,
  ObjectUnsubscribedError,
  zip,
} from "rxjs";

import {slo, rot, COM_PORTS, outfile} from "./cfg"

import { streamToRx } from "rxjs-stream";
import { JsxEmit } from "typescript";
import { createWriteStream } from "fs";
import { PrismaClient } from "@prisma/client";
import { stdout } from "process";

import "dotenv/config";

interface Measurement {
  device_id: number;
  sensor_index: number;
  sensor_value: number;
  battery_value: number;
  timestamp?: Date;
}

type FlatMeasurement = {
  [key: `${number}_${number}_${"value" | "time"}`]: number;
} & {
  [key in `${'slo' | 'rot'}`]: 0 | 1
}

const bufferBySensorIndex = () => (source$: Observable<Measurement>) => {
  const reset_buffer$ = source$.pipe(
    share(),
    pairwise(),
    filter(([prev, curr]) => prev.sensor_index > curr.sensor_index)
  );
  return source$.pipe(
    pairwise(),
    map(([p, c]) => p),
    buffer(reset_buffer$)
  );
};

const listenToPort = (path: `COM${number}`) => {
  const port = new SerialPortStream(
    { binding, path, baudRate: 9600 },
    console.log
  );
  const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));
  const port$ = streamToRx(parser);

  return port$.pipe(
    map((val) => val.toString().trim()),
    map((s) => JSON.parse(s) as Measurement),
    map((m) => ({ ...m, timestamp: new Date() }))
  );
};

const out = createWriteStream(`./data/${outfile}.log`);
// const out = stdout;

const ports = COM_PORTS.map(listenToPort);
const buffered = ports.map((port) => port.pipe(bufferBySensorIndex()));
const combined = zip(...buffered).pipe(
  map((grid) =>
    grid.flat().reduce<FlatMeasurement>(
      (acc, m) => ({
        ...acc,
        [`${m.device_id}_${m.sensor_index}_value`]: m.sensor_value,
        [`${m.device_id}_${m.sensor_index}_time`]: m.timestamp,
      }),
      {slo, rot}
    )
  )
);
combined
  .pipe(map((m) => JSON.stringify(m) + "\n"))
  .subscribe((s) => out.write(s));
