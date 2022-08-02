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
} from "rxjs";

import { streamToRx } from "rxjs-stream";
import { JsxEmit } from "typescript";
import { createWriteStream } from "fs";
import { PrismaClient } from "@prisma/client";

interface Measurement {
  device_id: number;
  sensor_index: number;
  sensor_value: number;
  battery_value: number;
  timestamp?: Date;
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

const prisma = new PrismaClient();

(async () => {
  for (const path of ["COM6", "COM7", "COM10"] as const) {
    listenToPort(path).subscribe(async (m) => await prisma.measurement.create({ data: m }));
  }
})().catch(() => prisma.$disconnect());
