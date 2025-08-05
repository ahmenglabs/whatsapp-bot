import "dotenv/config.js"
import terminal from "../utils/terminal.js"
import pkg from "whatsapp-web.js"
const { MessageTypes } = pkg

/**
 * Handle the sticker command
 * @param {import("whatsapp-web.js").Message} message - The incoming message
 * @param {import("whatsapp-web.js").Chat} chat - The chat where the message was sent
 */
const imageOrVideoToStickerHandler = async (message, chat) => {
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
      await chat.sendStateTyping()
      return message.reply(
        "Kirim gambar atau video untuk diubah menjadi stiker. Atau quote pesan yang berisi gambar atau video."
      )
    }

    let media = message.hasQuotedMsg ? await quotedMessage.downloadMedia() : await message.downloadMedia()

    if (!media) {
      await chat.sendStateTyping()
      return message.reply("Tidak dapat mengunduh media. Coba kirim ulang ya!")
    }

    await chat.sendStateTyping()
    await message.reply(media, undefined, {
      sendMediaAsSticker: true,
    })
  } catch (error) {
    terminal.error(error)
    await chat.sendStateTyping()
    await message.reply("Lagi ada error nih, coba lagi nanti ya!")
    throw error
  }
}

/**
 * Handle the sticker command
 * @param {import("whatsapp-web.js").Message} message - The incoming message
 * @param {import("whatsapp-web.js").Chat} chat - The chat where the message was sent
 */
const stickerToImageOrVideoHandler = async (message, chat) => {
  try {
    if (!message.hasQuotedMsg) return message.reply("Silahkan quote sticker yang mau dikonversi!")
    const quotedMessage = await message.getQuotedMessage()
    if (quotedMessage.type !== MessageTypes.STICKER) return message.reply("Silahkan quote sticker yang mau dikonversi!")

    const media = await quotedMessage.downloadMedia()
    if (!media) {
      await chat.sendStateTyping()
      return message.reply("Tidak dapat mengunduh media. Coba kirim ulang ya!")
    }

    await chat.sendStateTyping()
    await message.reply("Berikut adalah hasil konversi.", undefined, {
      media: media,
    })
  } catch (error) {
    terminal.error(error)
    await chat.sendStateTyping()
    await message.reply("Lagi ada error nih, coba lagi nanti ya!")
    throw error
  }
}

export { imageOrVideoToStickerHandler, stickerToImageOrVideoHandler }
