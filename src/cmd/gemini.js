import "dotenv/config.js"
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai"
import wav from "wav"
import pkg from "whatsapp-web.js"
const { MessageMedia } = pkg
import ffmpeg from "fluent-ffmpeg"

import terminal from "../utils/terminal.js"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH)
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
]

let systemInstruction = undefined

try {
  systemInstruction = fs.readFileSync(path.join(__dirname, "../../system-instruction.txt"), "utf8")
} catch (error) {
  terminal.warn(`Failed to load system instruction: ${error.message}`)
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const chatHistory = new Map()

/**
 * Handle incoming messages
 * @param {import("whatsapp-web.js").Message} message - The incoming message
 * @param {import("whatsapp-web.js").Chat} roomChat - The chat object
 */
const geminiHandler = async (message, roomChat) => {
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
        systemInstruction: systemInstruction,
        safetySettings: safetySettings,
      },
    })

    const quotedMessage = message.hasQuotedMsg ? await message.getQuotedMessage() : null
    let contents

    if (message.hasMedia || (message.hasQuotedMsg && quotedMessage.hasMedia)) {
      const media = message.hasMedia ? await message.downloadMedia() : await quotedMessage.downloadMedia()
      contents = [
        {
          inlineData: {
            mimeType: media.mimetype,
            data: media.data,
          },
        },
        {
          text: message.hasQuotedMsg ? `Replying to: ${quotedMessage.body}\n\n${message.body}` : message.body,
        },
      ]
    } else {
      contents = [
        {
          text: message.body,
        },
      ]
    }

    const response = await chat.sendMessage({
      message: contents,
    })

    chatHistory.set(chatId, chat.getHistory())
    textToSpeech(response.text, "out.wav")
      .then(async () => {
        const media = MessageMedia.fromFilePath(path.join(__dirname, "out.opus"))
        await roomChat.sendStateRecording()
        await message.reply(media, undefined, { sendAudioAsVoice: true })

        fs.unlinkSync(path.join(__dirname, "out.wav"))
        fs.unlinkSync(path.join(__dirname, "out.opus"))
      })
      .catch(async (error) => {
        terminal.error(error)
        await roomChat.sendStateTyping()
        await message.reply(response.text)
      })
  } catch (error) {
    console.error(`Error handling gemini command: ${error.message}`)
    await message.reply("Lagi ada error nih, coba lagi nanti ya!")
    throw error
  }
}

const convertWavToOpus = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec("libopus")
      .audioBitrate("64k")
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run()
  })
}

const saveWaveFile = (filename, pcmData, channels = 1, rate = 24000, sampleWidth = 2) => {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, filename)
    const writer = new wav.FileWriter(fullPath, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    })

    writer.on("finish", resolve)
    writer.on("error", reject)

    writer.write(pcmData)
    writer.end()
  })
}

const textToSpeech = async (text, fileName) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read aloud in a warm and friendly tone: ${text}` }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        prebuiltVoiceConfig: { voiceName: "Zephyr", language: "id-ID" },
      },
    },
  })

  const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
  const audioBuffer = Buffer.from(data, "base64")

  const wavPath = fileName
  const opusPath = fileName.replace(".wav", ".opus")

  await saveWaveFile(wavPath, audioBuffer)
  await convertWavToOpus(path.join(__dirname, wavPath), path.join(__dirname, opusPath))

  return opusPath
}

export default geminiHandler
