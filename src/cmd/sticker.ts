import "dotenv/config.js"
import terminal from "../utils/terminal.js"
import pkg from "whatsapp-web.js"
const { MessageTypes } = pkg
import type { Message, Chat } from "whatsapp-web.js"

const imageOrVideoToStickerHandler = async (message: Message, chat: Chat) => {
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

    let media =
      message.hasQuotedMsg && quotedMessage ? await quotedMessage.downloadMedia() : await message.downloadMedia()

    if (!media) {
      await chat.sendStateTyping()
      return message.reply("Tidak dapat mengunduh media. Coba kirim ulang ya!")
    }

    await chat.sendStateTyping()
    await message.reply(media, undefined, {
      sendMediaAsSticker: true,
    })
  } catch (error) {
    terminal.error(error instanceof Error ? error.message : String(error))
    await chat.sendStateTyping()
    await message.reply("Lagi ada error nih, coba lagi nanti ya!")
    throw error
  }
}

const stickerToImageOrVideoHandler = async (message: Message, chat: Chat) => {
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
    terminal.error(error instanceof Error ? error.message : String(error))
    await chat.sendStateTyping()
    await message.reply("Lagi ada error nih, coba lagi nanti ya!")
    throw error
  }
}

export { imageOrVideoToStickerHandler, stickerToImageOrVideoHandler }
