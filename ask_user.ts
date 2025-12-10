import { tool } from "@opencode-ai/plugin"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

// IPC Configuration
const IPC_DIR = path.join(os.homedir(), ".opencode", "ask_user")
const POLL_INTERVAL_MS = 500
const DEFAULT_TIMEOUT_SEC = 300 // 5 minutes

// Ensure IPC directory exists
function ensureIpcDir() {
  if (!fs.existsSync(IPC_DIR)) {
    fs.mkdirSync(IPC_DIR, { recursive: true })
  }
}

// Generate a unique question ID
function generateQuestionId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  return `q_${timestamp}_${random}`
}

// Question and Response interfaces
interface Question {
  id: string
  question: string
  title?: string
  sessionID: string
  messageID: string
  timestamp: number
}

interface Response {
  id: string
  response: string
  responded: boolean
  timestamp: number
}

export default tool({
  description: `Ask the user a question and wait for their free-form text response.

Use this tool when you need explicit user input, confirmation, or clarification before proceeding with a task. The user will see the question in a separate terminal window running the ask-user-cli helper and can type their response.

IMPORTANT GUIDELINES:
- Use this for questions that genuinely require user input or decisions
- Be specific and clear in your questions
- Provide context in the title parameter when helpful
- The user can cancel by pressing Ctrl+C in the CLI helper

The tool will wait for the user's response (default timeout: 5 minutes).`,

  args: {
    question: tool.schema
      .string()
      .describe("The question to ask the user. Be specific and clear."),
    title: tool.schema
      .string()
      .optional()
      .describe("Optional title providing context for the question"),
    timeout: tool.schema
      .number()
      .optional()
      .describe("Timeout in seconds to wait for response (default: 300 = 5 minutes)"),
  },

  async execute(args, context) {
    ensureIpcDir()

    const questionId = generateQuestionId()
    const timeoutSec = args.timeout ?? DEFAULT_TIMEOUT_SEC
    const timeoutMs = timeoutSec * 1000

    // Create the question file
    const questionData: Question = {
      id: questionId,
      question: args.question,
      title: args.title,
      sessionID: context.sessionID,
      messageID: context.messageID,
      timestamp: Date.now(),
    }

    const questionFile = path.join(IPC_DIR, `question_${questionId}.json`)
    const responseFile = path.join(IPC_DIR, `response_${questionId}.json`)

    // Write the question file
    fs.writeFileSync(questionFile, JSON.stringify(questionData, null, 2))

    const startTime = Date.now()

    try {
      // Poll for response
      while (true) {
        // Check for abort signal
        if (context.abort.aborted) {
          // Clean up question file
          if (fs.existsSync(questionFile)) {
            fs.unlinkSync(questionFile)
          }
          return JSON.stringify({
            responded: false,
            response: "",
            cancelled: true,
            reason: "Agent aborted the request",
          })
        }

        // Check for timeout
        if (Date.now() - startTime > timeoutMs) {
          // Clean up question file
          if (fs.existsSync(questionFile)) {
            fs.unlinkSync(questionFile)
          }
          return JSON.stringify({
            responded: false,
            response: "",
            cancelled: true,
            reason: `Timeout after ${timeoutSec} seconds waiting for user response`,
          })
        }

        // Check for response file
        if (fs.existsSync(responseFile)) {
          try {
            const responseData: Response = JSON.parse(
              fs.readFileSync(responseFile, "utf-8")
            )

            // Clean up files
            if (fs.existsSync(questionFile)) {
              fs.unlinkSync(questionFile)
            }
            fs.unlinkSync(responseFile)

            if (responseData.responded) {
              return JSON.stringify({
                responded: true,
                response: responseData.response,
                cancelled: false,
              })
            } else {
              return JSON.stringify({
                responded: false,
                response: "",
                cancelled: true,
                reason: "User cancelled the request",
              })
            }
          } catch (e) {
            // Response file might be partially written, wait and retry
          }
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(questionFile)) {
        fs.unlinkSync(questionFile)
      }
      if (fs.existsSync(responseFile)) {
        fs.unlinkSync(responseFile)
      }
      throw error
    }
  },
})
