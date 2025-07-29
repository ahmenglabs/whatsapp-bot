import "dotenv/config"
import terminal from "./utils/terminal.js"
import pkg from "whatsapp-web.js"
const { MessageTypes } = pkg

// Command Handlers
import { imageOrVideoToStickerHandler, stickerToImageOrVideoHandler } from "./cmd/sticker.js"
import geminiHandler from "./cmd/gemini.js"

const geminiEnabled = new Set()

/**
 * Handle incoming messages
 * @param {import("whatsapp-web.js").Message} message - The incoming message
 */
const handleMessage = async (message) => {
  try {
    if (
      message.type !== MessageTypes.AUDIO &&
      message.type !== MessageTypes.VOICE &&
      message.type !== MessageTypes.TEXT &&
      message.type !== MessageTypes.IMAGE &&
      message.type !== MessageTypes.VIDEO
    )
      return

    const text = message.body
    const cmd = text.toLowerCase().trim().split(" ")[0]
    const prefix = process.env.PREFIX || "."
    const isCmd = text.startsWith(prefix)
    const chat = await message.getChat()
    const isGroup = chat.isGroup
    const args = text.slice(prefix.length).trim().split(/ +/).slice(1)

    switch (cmd) {
      case prefix + "sticker":
      case "stiker":
        await Promise.all([chat.sendSeen(), chat.sendStateTyping(), imageOrVideoToStickerHandler(message)])
        break

      case prefix + "toimage":
      case prefix + "tovideo":
        await Promise.all([chat.sendSeen(), chat.sendStateTyping(), stickerToImageOrVideoHandler(message)])
        break

      case prefix + "gemini":
        await Promise.all([chat.sendSeen(), chat.sendStateTyping()])

        if (args.length === 0) return message.reply("Contoh: .gemini on atau .gemini off")
        if (args[0] === "on") {
          if (geminiEnabled.has(message.from)) {
            return message.reply("Gemini sudah aktif di chat ini.")
          }
          geminiEnabled.add(message.from)
          return message.reply("Gemini telah diaktifkan di chat ini.")
        } else if (args[0] === "off") {
          if (!geminiEnabled.has(message.from)) {
            return message.reply("Gemini belum aktif di chat ini.")
          }
          geminiEnabled.delete(message.from)
          return message.reply("Gemini telah dinonaktifkan di chat ini.")
        } else {
          return message.reply("Perintah tidak dikenali. Gunakan .gemini on atau .gemini off")
        }

      default:
        break
    }

    if ((!isCmd && !isGroup) || (!isCmd && geminiEnabled.has(message.from))) {
      await Promise.all([chat.sendSeen(), geminiHandler(message, chat)])
    }
  } catch (error) {
    terminal.error(error)
  }
}

export default handleMessage
