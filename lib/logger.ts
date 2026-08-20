import { toArgentinaISOString } from "./timezone"

const isDev = process.env.ENV !== "production"

function format(level: string, message: string, meta?: Record<string, unknown>): string {
  // Timestamp en hora de Argentina, con el offset explícito: sigue siendo ISO
  // parseable, pero se lee en la misma hora que el gimnasio que reporta el bug.
  const ts = toArgentinaISOString()
  if (isDev) {
    const metaStr = meta ? " " + JSON.stringify(meta) : ""
    return `[${ts}] ${level.padEnd(5)} ${message}${metaStr}`
  }
  return JSON.stringify({ ts, level, message, ...meta })
}

export const logger = {
  info:  (msg: string, meta?: Record<string, unknown>) => console.log(format("INFO",  msg, meta)),
  warn:  (msg: string, meta?: Record<string, unknown>) => console.warn(format("WARN",  msg, meta)),
  error: (msg: string, meta?: Record<string, unknown>) => console.error(format("ERROR", msg, meta)),
}
