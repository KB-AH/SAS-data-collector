export const COM_PORTS: readonly `COM${number}`[] = [
  // "COM6", // SAS3
  // "COM7", // SAS1
  "COM10" // SAS0
] as const;

export const slo: 0 | 1 = 1;
export const rot: 0 | 1 = 0;

export const outfile = "ma_1_right_1"