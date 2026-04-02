const isDev = process.env.ENV !== "production"

function format(level: string, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString()
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
