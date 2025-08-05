import { spawn } from "node:child_process"
import terminal from "../utils/terminal.js"

/**
 * Handle the Python code execution command
 * @param {import("whatsapp-web.js").Message} message - The incoming message
 * @param {import("whatsapp-web.js").Chat} chat - The chat where the message was sent
 * @param {string} code - The Python code to execute
 */
const runPythonCodeHandler = async (message, chat, code) => {
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
    terminal.error(`Python execution error: ${error.message}`)
    const errorMessage = `Kode dijalankan dalam ${executionTime} detik\n\n${error.message}`

    await chat.sendStateTyping()
    await message.reply(errorMessage)
  }
}

export { runPythonCodeHandler }
