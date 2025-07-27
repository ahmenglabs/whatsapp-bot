import dayjs from "dayjs"
import utc from "dayjs/plugin/utc.js"
import timezone from "dayjs/plugin/timezone.js"

dayjs.extend(utc)
dayjs.extend(timezone)

dayjs.tz.setDefault("Asia/Jakarta")

const terminal = {
  info: (message) => {
    console.info(`[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] [INFO] ${message}`)
  },
  warn: (message) => {
    console.warn(`[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] [WARN] ${message}`)
  },
  error: (message) => {
    console.error(`[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] [ERROR] ${message}`)
  },
}

export default terminal
