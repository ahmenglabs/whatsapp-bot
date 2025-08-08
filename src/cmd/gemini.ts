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
import type { Message, Chat } from "whatsapp-web.js"

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

let systemInstruction = ""

try {
  systemInstruction = fs.readFileSync(path.join(__dirname, "../../system-instruction.txt"), "utf8")
} catch (error) {
  terminal.warn(`Failed to load system instruction: ${error instanceof Error ? error.message : String(error)}`)
}

if (process.env.GEMINI_API_KEY === undefined) {
  throw new Error("GEMINI_API_KEY is not defined")
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const chatHistory = new Map()

let totalGeminiFlashError = 0
let totalGeminiFlashLiteError = 0
let totalGeminiFlashTtsError = 0
let lastErrorCountReset = Date.now()

const resetErrorCountsIfNeeded = () => {
  if (Date.now() - lastErrorCountReset >= 60 * 60 * 1000) {
    totalGeminiFlashError = 0
    totalGeminiFlashLiteError = 0
    totalGeminiFlashTtsError = 0
    lastErrorCountReset = Date.now()
  }
}

/**
 * Handle incoming messages
 * @param {import("whatsapp-web.js").Message} message - The incoming message
 * @param {import("whatsapp-web.js").Chat} roomChat - The chat object
 */
const geminiHandler = async (message: Message, roomChat: Chat) => {
  resetErrorCountsIfNeeded()
  let modelName = "gemini-2.5-flash"

  try {
    const chatId = message.from
    const contact = await message.getContact()
    const authorName = contact.name || contact.pushname || "Unknown"
    const history = chatHistory.get(chatId) || []

    if (totalGeminiFlashError >= 3) {
      modelName = "gemini-2.5-flash-lite"
    }

    const chat = ai.chats.create({
      model: modelName,
      history: history,
      config: {
        systemInstruction: systemInstruction,
        safetySettings: safetySettings,
      },
    })

    const quotedMessage = message.hasQuotedMsg ? await message.getQuotedMessage() : null
    const quotedMessageContact = quotedMessage ? await quotedMessage?.getContact() : null
    const quotedAuthorName = quotedMessageContact
      ? quotedMessageContact.name || quotedMessageContact.pushname || "Unknown"
      : "Unknown"
    let contents

    if (message.hasMedia || (message.hasQuotedMsg && quotedMessage && quotedMessage?.hasMedia)) {
      const media = message.hasMedia ? await message.downloadMedia() : await quotedMessage?.downloadMedia()
      if (media) {
        contents = [
          {
            inlineData: {
              mimeType: media.mimetype,
              data: media.data,
            },
          },
          {
            text: message.hasQuotedMsg
              ? `Replying to ${quotedMessage?.fromMe ? process.env.BOT_NAME : quotedAuthorName}: ${quotedMessage?.body}\n\n${authorName}: ${message.body}`
              : `${authorName}: ${message.body}`,
          },
        ]
      } else {
        contents = [
          {
            text: message.hasQuotedMsg
              ? `Replying to ${quotedMessage?.fromMe ? process.env.BOT_NAME : quotedAuthorName}: ${quotedMessage?.body}\n\n${authorName}: ${message.body}`
              : `${authorName}: ${message.body}`,
          },
        ]
      }
    } else {
      contents = [
        {
          text: message.hasQuotedMsg
            ? `Replying to ${quotedMessage?.fromMe ? process.env.BOT_NAME : quotedAuthorName}: ${quotedMessage?.body}\n\n${authorName}: ${message.body}`
            : `${authorName}: ${message.body}`,
        },
      ]
    }

    const response = await chat.sendMessage({
      message: contents,
    })

    chatHistory.set(chatId, chat.getHistory())
    const responseText = response.text || "Sorry, I couldn't generate a response."
    textToSpeech(responseText, "out.wav")
      .then(async () => {
        if (fs.existsSync(path.join(__dirname, "out.wav"))) {
          const media = MessageMedia.fromFilePath(path.join(__dirname, "out.opus"))
          await roomChat.sendStateRecording()
          await message.reply(media, undefined, { sendAudioAsVoice: true })

          fs.unlinkSync(path.join(__dirname, "out.wav"))
          fs.unlinkSync(path.join(__dirname, "out.opus"))
        } else {
          await roomChat.sendStateTyping()
          await message.reply(responseText)
        }
      })
      .catch(async (error) => {
        terminal.error(error)
      })
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    try {
      if (modelName === "gemini-2.5-flash") {
        totalGeminiFlashError++
      } else if (modelName === "gemini-2.5-flash-lite") {
        totalGeminiFlashLiteError++
      }

      if (totalGeminiFlashError < 3) {
        await message.reply("Oops, ada yang error nih. Coba kirim lagi pesannya ya!")
        return
      }

      if (totalGeminiFlashError >= 3 && totalGeminiFlashLiteError < 3) {
        try {
          const chatId = message.from
          const contact = await message.getContact()
          const authorName = contact.name || contact.pushname || "Unknown"

          const history = chatHistory.get(chatId) || []
          const chat = ai.chats.create({
            model: "gemini-2.5-flash-lite",
            history: history,
            config: {
              systemInstruction: systemInstruction,
              safetySettings: safetySettings,
            },
          })

          const quotedMessage = message.hasQuotedMsg ? await message.getQuotedMessage() : null
          const quotedMessageContact = quotedMessage ? await quotedMessage?.getContact() : null
          const quotedAuthorName = quotedMessageContact
            ? quotedMessageContact.name || quotedMessageContact.pushname || "Unknown"
            : "Unknown"
          let contents

          if (message.hasMedia || (message.hasQuotedMsg && quotedMessage?.hasMedia)) {
            const media = message.hasMedia ? await message.downloadMedia() : await quotedMessage?.downloadMedia()
            if (media) {
              contents = [
                {
                  inlineData: {
                    mimeType: media.mimetype,
                    data: media.data,
                  },
                },
                {
                  text: message.hasQuotedMsg
                    ? `Replying to ${quotedMessage?.fromMe ? process.env.BOT_NAME : quotedAuthorName}: ${quotedMessage?.body}\n\n${authorName}: ${message.body}`
                    : `${authorName}: ${message.body}`,
                },
              ]
            } else {
              contents = [
                {
                  text: message.hasQuotedMsg
                    ? `Replying to ${quotedMessage?.fromMe ? process.env.BOT_NAME : quotedAuthorName}: ${quotedMessage?.body}\n\n${authorName}: ${message.body}`
                    : `${authorName}: ${message.body}`,
                },
              ]
            }
          } else {
            contents = [
              {
                text: message.hasQuotedMsg
                  ? `Replying to ${quotedMessage?.fromMe ? process.env.BOT_NAME : quotedAuthorName}: ${quotedMessage?.body}\n\n${authorName}: ${message.body}`
                  : `${authorName}: ${message.body}`,
              },
            ]
          }

          const response = await chat.sendMessage({
            message: contents,
          })

          chatHistory.set(chatId, chat.getHistory())
          const responseText = response.text || "Sorry, I couldn't generate a response."
          textToSpeech(responseText, "out.wav")
            .then(async () => {
              if (fs.existsSync(path.join(__dirname, "out.wav"))) {
                const media = MessageMedia.fromFilePath(path.join(__dirname, "out.opus"))
                await roomChat.sendStateRecording()
                await message.reply(media, undefined, { sendAudioAsVoice: true })

                fs.unlinkSync(path.join(__dirname, "out.wav"))
                fs.unlinkSync(path.join(__dirname, "out.opus"))
              } else {
                await roomChat.sendStateTyping()
                await message.reply(responseText)
              }
            })
            .catch(async (error) => {
              terminal.error(error)
            })
          return
          // eslint-disable-next-line no-unused-vars
        } catch (error) {
          totalGeminiFlashLiteError++
        }
      }

      if (totalGeminiFlashError >= 3 && totalGeminiFlashLiteError >= 3) {
        await message.reply("Gemini lagi kena rate limit nih, coba lagi nanti ya!")
      } else {
        await message.reply("Oops, ada yang error nih. Coba kirim lagi pesannya ya!")
      }
    } catch (error) {
      terminal.error(String(error))
      message.reply("Lagi error nih, coba lagi nanti ya!")
    }
  }
}

const convertWavToOpus = (inputPath: string, outputPath: string): Promise<string> => {
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

const saveWaveFile = (
  filename: string,
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<void> => {
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

const textToSpeech = async (text: string, fileName: string): Promise<string | undefined> => {
  try {
    if (totalGeminiFlashTtsError >= 3) return

    if (process.env.SPEAKER_1 === undefined || process.env.SPEAKER_2 === undefined) {
      throw new Error("SPEAKER_1 and SPEAKER_2 must be defined")
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [
        {
          parts: [
            {
              text: `TTS the following conversation between ${process.env.SPEAKER_1} and ${process.env.SPEAKER_2}:\n\n${text}\n\nUse warm and romantic tones.`,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: process.env.SPEAKER_1,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Zephyr" },
                },
              },
              {
                speaker: process.env.SPEAKER_2,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Puck" },
                },
              },
            ],
          },
        },
      },
    })

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
    if (!data) {
      throw new Error("No audio data received from API")
    }

    const audioBuffer = Buffer.from(data, "base64")

    const wavPath = fileName
    const opusPath = fileName.replace(".wav", ".opus")

    await saveWaveFile(wavPath, audioBuffer)
    await convertWavToOpus(path.join(__dirname, wavPath), path.join(__dirname, opusPath))

    return opusPath
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    totalGeminiFlashTtsError++
  }
}

export default geminiHandler
