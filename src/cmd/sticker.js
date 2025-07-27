import "dotenv/config.js"
import terminal from "../utils/terminal.js"
import pkg from "whatsapp-web.js"
const { MessageTypes } = pkg

/**
 * Handle the sticker command
 * @param {import("whatsapp-web.js").Message} message - The incoming message
 * @param {import("whatsapp-web.js").Client} client - The WhatsApp client instance
 */
const imageOrVideoToStickerHandler = async (message) => {
  try {
    let quotedMessage
    if (message.hasQuotedMsg) {
      quotedMessage = await message.getQuotedMessage()
    }

    if (
      message.type !== MessageTypes.IMAGE &&
      message.type !== MessageTypes.VIDEO &&
      (!quotedMessage || (quotedMessage.type !== MessageTypes.IMAGE && quotedMessage.type !== MessageTypes.VIDEO))
    ) {
      return message.reply(
        "Kirim gambar atau video untuk diubah menjadi stiker. Atau quote pesan yang berisi gambar atau video."
      )
    }

    let media
    if (quotedMessage) {
      media = await quotedMessage.downloadMedia()
    } else {
      media = await message.downloadMedia()
    }

    if (!media) {
      return message.reply("Tidak dapat mengunduh media. Coba kirim ulang ya!")
    }

    await message.reply(media, undefined, {
      sendMediaAsSticker: true,
    })
  } catch (error) {
    terminal.error(`Error handling sticker command: ${error.message}`)
    await message.reply("Lagi ada error nih, coba lagi nanti ya!")
    throw error
  }
}

const stickerToImageOrVideoHandler = async (message) => {
  try {
    if (!message.hasQuotedMsg) return message.reply("Silahkan quote sticker yang mau dikonversi!")
    const quotedMessage = await message.getQuotedMessage()
    if (quotedMessage.type !== MessageTypes.STICKER) return message.reply("Silahkan quote sticker yang mau dikonversi!")

    const media = await quotedMessage.downloadMedia()
    if (!media) return message.reply("Tidak dapat mengunduh media. Coba kirim ulang ya!")

    await message.reply(media)
  } catch (error) {
    terminal.error(`Error converting sticker to image/video: ${error.message}`)
    await message.reply("Lagi ada error nih, coba lagi nanti ya!")
    throw error
  }
}

export { imageOrVideoToStickerHandler, stickerToImageOrVideoHandler }
