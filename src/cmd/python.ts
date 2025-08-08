import { spawn } from "node:child_process"
import terminal from "../utils/terminal.js"
import type { Message, Chat } from "whatsapp-web.js"

const runPythonCodeHandler = async (message: Message, chat: Chat, code: string) => {
  const startTime = Date.now()

  try {
    let output = ""
    let errorOutput = ""
    let isCompleted = false
    const timeoutRuntime = 2 * 60 * 1000

    const pythonPromise = new Promise((resolve) => {
      const pythonPath = process.env.PYTHON_PATH || "python"
      const pythonProcess = spawn(pythonPath, ["-u", "-c", code])

      pythonProcess.stdout.on("data", (data) => {
        output += data.toString()
      })

      pythonProcess.stderr.on("data", (data) => {
        errorOutput += data.toString()
      })

      pythonProcess.on("close", () => {
        isCompleted = true

        let result
        if (errorOutput) {
          result = errorOutput.trim()
        } else if (output) {
          result = output.trim()
        } else {
          result = "Tidak ada output"
        }

        resolve(result)
      })

      pythonProcess.on("error", (error) => {
        isCompleted = true
        resolve(error.message)
      })
    })

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        if (!isCompleted) {
          if (errorOutput) {
            resolve(errorOutput.trim())
          } else if (output) {
            resolve(output.trim())
          } else {
            resolve("Timeout - Tdak ada output")
          }
        }
      }, timeoutRuntime)
    })

    const result = await Promise.race([pythonPromise, timeoutPromise])
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2)
    const responseMessage = `Kode dijalankan dalam ${executionTime} detik\n\n${result}`

    await chat.sendStateTyping()
    await message.reply(responseMessage)
  } catch (error) {
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2)
    const errorMessage = error instanceof Error ? error.message : String(error)
    terminal.error(`Python execution error: ${errorMessage}`)
    const responseMessage = `Kode dijalankan dalam ${executionTime} detik\n\n${errorMessage}`

    await chat.sendStateTyping()
    await message.reply(responseMessage)
  }
}

export { runPythonCodeHandler }
