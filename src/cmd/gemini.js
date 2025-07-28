import "dotenv/config.js"
import { GoogleGenAI } from "@google/genai"
import terminal from "../utils/terminal.js"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let systemInstruction = undefined

try {
  systemInstruction = fs.readFileSync(path.join(__dirname, "../../system-instruction.txt"), "utf8")
} catch (error) {
  terminal.warn(`Failed to load system instruction: ${error.message}`)
}

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY})

const chatHistory = new Map()

/**
 * Handle incoming messages
 * @param {import("whatsapp-web.js").Message} message - The incoming message
 */
const geminiHandler = async (message) => {
  try {
    const chatId = message.from
    if (!chatHistory.has(chatId)) {
      chatHistory.set(chatId, [])
    }
    const history = chatHistory.get(chatId)
    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      history: history,
      config: {
        systemInstruction: systemInstruction
      }
    })

    const quotedMessage = message.hasQuotedMsg ? await message.getQuotedMessage() : null
    let contents

    if (message.hasMedia || (message.hasQuotedMsg && quotedMessage.hasMedia)) {
      const media = message.hasMedia ? await message.downloadMedia() : await quotedMessage.downloadMedia()
      contents = [
        {
          inlineData: {
            mimeType: media.mimetype,
            data: media.data
          }
        },
        {
          text: message.hasQuotedMsg ? `Replying to: ${quotedMessage.body}\n\n${message.body}` : message.body
        }
      ]
    } else {
      contents = [
        {
          text: message.body
        }
      ]
    }

    const response = await chat.sendMessage({
      message: contents,
    })

    chatHistory.set(chatId, chat.getHistory())
    await message.reply(response.text)
  } catch (error) {
    console.error(`Error handling gemini command: ${error.message}`)
    await message.reply("Lagi ada error nih, coba lagi nanti ya!")
    throw error
  }
}

export default geminiHandler