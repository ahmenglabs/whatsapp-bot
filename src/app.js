import "dotenv/config.js"
import pkg from "whatsapp-web.js"
const { Client, LocalAuth } = pkg
import terminal from "./utils/terminal.js"
import handleMessage from "./handleMessage.js"

const client = new Client({
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
  authStrategy: new LocalAuth(),
  ffmpegPath: process.env.FFMPEG_PATH,
})

let loadingPercent = 0

client.on("loading_screen", (percent) => {
  loadingPercent = percent
  terminal.info(`Loading: ${loadingPercent}%`)
})

client.on("qr", (qr) => {
  terminal.info("QR Code received, scan it with your WhatsApp app to log in.")
  terminal.info(qr)
})

client.on("ready", () => {
  terminal.info("WhatsApp Bot is running! CTRL + C to stop.")
})

client.on("message", async (message) => {
  if (loadingPercent < 99) return
  await handleMessage(message)
})

client.on("disconnected", (reason) => {
  terminal.error(`Client was disconnected. Reason: ${reason}`)
})

client.initialize()
