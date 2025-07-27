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

client.on("loading_screen", (percent) => {
  terminal.info(`Loading: ${percent}%`)
})

client.on("qr", (qr) => {
  terminal.info("QR Code received, scan it with your WhatsApp app to log in.")
  terminal.info(qr)
})

client.on("ready", () => {
  terminal.info("WhatsApp Bot is running! CTRL + C to stop.")
})

client.on("message", async (message) => await handleMessage(message))

client.on("disconnected", (reason) => {
  terminal.error(`Client was disconnected. Reason: ${reason}`)
})

client.initialize()
