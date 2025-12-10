#!/usr/bin/env bun
/**
 * ask-user-cli.ts
 * 
 * CLI helper for the ask_user tool. Run this in a separate terminal to
 * receive questions from opencode and provide responses.
 * 
 * Usage:
 *   bun run .opencode/tool/ask-user-cli.ts
 *   # or
 *   chmod +x .opencode/tool/ask-user-cli.ts && ./.opencode/tool/ask-user-cli.ts
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import * as readline from "readline"

// IPC Configuration (must match ask_user.ts)
const IPC_DIR = path.join(os.homedir(), ".opencode", "ask_user")
const POLL_INTERVAL_MS = 500

// ANSI color codes for pretty output
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
}

// Question interface (must match ask_user.ts)
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

// Ensure IPC directory exists
function ensureIpcDir() {
  if (!fs.existsSync(IPC_DIR)) {
    fs.mkdirSync(IPC_DIR, { recursive: true })
  }
}

// Get all pending question files
function getPendingQuestions(): Question[] {
  ensureIpcDir()
  
  const files = fs.readdirSync(IPC_DIR)
    .filter(f => f.startsWith("question_") && f.endsWith(".json"))
    .sort() // Process in order
  
  const questions: Question[] = []
  
  for (const file of files) {
    try {
      const filepath = path.join(IPC_DIR, file)
      const data = JSON.parse(fs.readFileSync(filepath, "utf-8"))
      questions.push(data)
    } catch (e) {
      // Skip malformed files
    }
  }
  
  return questions
}

// Write response file
function writeResponse(questionId: string, response: string, responded: boolean) {
  const responseData: Response = {
    id: questionId,
    response,
    responded,
    timestamp: Date.now(),
  }
  
  const responseFile = path.join(IPC_DIR, `response_${questionId}.json`)
  fs.writeFileSync(responseFile, JSON.stringify(responseData, null, 2))
}

// Format timestamp
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

// Print a horizontal line
function printLine(char = "─", width = 60) {
  console.log(colors.dim + char.repeat(width) + colors.reset)
}

// Print the header
function printHeader() {
  console.clear()
  console.log()
  console.log(`${colors.bold}${colors.cyan}  🤖 opencode ask_user CLI${colors.reset}`)
  console.log(`${colors.dim}  Waiting for questions from the agent...${colors.reset}`)
  console.log(`${colors.dim}  Press Ctrl+C to exit${colors.reset}`)
  printLine()
  console.log()
}

// Print a question
function printQuestion(question: Question) {
  console.log()
  printLine("═")
  console.log()
  
  if (question.title) {
    console.log(`${colors.bold}${colors.yellow}  📋 ${question.title}${colors.reset}`)
    console.log()
  }
  
  console.log(`${colors.bold}${colors.cyan}  ❓ Question:${colors.reset}`)
  console.log()
  
  // Print the question with proper indentation
  const lines = question.question.split("\n")
  for (const line of lines) {
    console.log(`     ${line}`)
  }
  
  console.log()
  console.log(`${colors.dim}  Session: ${question.sessionID.slice(0, 12)}... | Time: ${formatTime(question.timestamp)}${colors.reset}`)
  printLine()
  console.log()
}

// Prompt for user input
async function promptUser(question: Question): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    console.log(`${colors.green}  ✏️  Your response (press Enter twice to submit, or type 'cancel' to cancel):${colors.reset}`)
    console.log()
    
    let lines: string[] = []
    let emptyLineCount = 0
    
    const prompt = () => {
      rl.question("     ", (line) => {
        if (line === "") {
          emptyLineCount++
          if (emptyLineCount >= 1 && lines.length > 0) {
            // Submit on empty line after content
            rl.close()
            
            const response = lines.join("\n").trim()
            
            if (response.toLowerCase() === "cancel") {
              console.log()
              console.log(`${colors.yellow}  ⚠️  Response cancelled${colors.reset}`)
              writeResponse(question.id, "", false)
            } else {
              console.log()
              console.log(`${colors.green}  ✅ Response sent!${colors.reset}`)
              writeResponse(question.id, response, true)
            }
            
            console.log()
            resolve()
            return
          }
        } else {
          emptyLineCount = 0
          lines.push(line)
        }
        
        prompt()
      })
    }
    
    prompt()
  })
}

// Set of processed question IDs to avoid duplicates
const processedQuestions = new Set<string>()

// Main loop
async function main() {
  printHeader()
  
  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    console.log()
    console.log(`${colors.yellow}  👋 Goodbye!${colors.reset}`)
    console.log()
    process.exit(0)
  })
  
  // Main polling loop
  while (true) {
    const questions = getPendingQuestions()
    
    for (const question of questions) {
      // Skip already processed questions
      if (processedQuestions.has(question.id)) {
        continue
      }
      
      // Mark as being processed
      processedQuestions.add(question.id)
      
      // Display and prompt
      printQuestion(question)
      await promptUser(question)
      
      // After responding, show waiting message again
      console.log(`${colors.dim}  Waiting for more questions...${colors.reset}`)
      console.log()
    }
    
    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

// Run
main().catch((error) => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`)
  process.exit(1)
})
