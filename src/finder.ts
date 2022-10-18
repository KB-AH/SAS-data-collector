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
  merge,
} from "rxjs";

import { slo, rot, COM_PORTS, outfile } from "./cfg";

import { streamToRx } from "rxjs-stream";
import { createWriteStream } from "fs";

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
  [key in `${"slo" | "rot"}`]: 0 | 1;
};

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

const ports = COM_PORTS.map((p) => listenToPort(p));

const listenGroups = () =>
  zip(...ports.map((p) => p.pipe(bufferBySensorIndex())))
    .pipe(
      map((g) =>
        g
          .flat()
          .sort((a, b) => a.sensor_value - b.sensor_value)
          // .filter(r => r.sensor_value < 100)
          .map((r) => `${r.device_id}-${r.sensor_index} = ${r.sensor_value}`)
      )
      // filter((r) => r.sensor_value < 50),
      // map((r) => `${r.device_id}-${r.sensor_index} = ${r.sensor_value}`)
    )
    .subscribe(console.log);

const listenEach = () =>
  merge(...ports)
    .pipe(map((r) => `${r.device_id}-${r.sensor_index} = ${r.sensor_value}`))
    .subscribe(console.log);

listenGroups();
