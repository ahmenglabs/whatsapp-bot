import "dotenv/config"
import terminal from "./utils/terminal.js"
import pkg from "whatsapp-web.js"
const { MessageTypes } = pkg

// Command Handlers
import handleStickerCommand from "./cmd/sticker.js"

/**
 * Handle incoming messages
 * @param {import("whatsapp-web.js").Message} message - The incoming message
 * @param {import("whatsapp-web.js").Client} client - The WhatsApp client instance
 */
const handleMessage = async (message) => {
  try {
    if (message.fromMe) return
    if (
      message.type !== MessageTypes.TEXT &&
      message.type !== MessageTypes.IMAGE &&
      message.type !== MessageTypes.VIDEO
    )
      return

    const from = message.from
    const messageId = message.id._serialized
    const text = message.body
    const cmd = text.toLowerCase().trim().slice(1).split(" ")[0]

    switch (cmd) {
      case "sticker":
        await handleStickerCommand(message)
        break

      default:
        break
    }
  } catch (error) {
    terminal.error(`Error handling message: ${error.message}`)
  }
}

export default handleMessage
