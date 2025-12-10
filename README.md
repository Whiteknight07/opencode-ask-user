# opencode-ask-user

A custom tool for [opencode](https://github.com/sst/opencode) that allows the LLM agent to pause and ask you for free-form text input during execution.

## Features

- 📝 **Free-form text input** - Not just approve/deny, actual text responses
- 🔌 **Pure custom tool** - No modifications to opencode required
- ⏱️ **Timeout handling** - Default 5 minute timeout, configurable
- ❌ **Cancellation support** - User can cancel, agent abort signal respected
- 📄 **Multi-line responses** - Type as much as you want

## Installation

### 1. Install the plugin dependency

The tool requires `@opencode-ai/plugin`. If you don't have it installed:

```bash
# Navigate to your global opencode config directory
cd ~/.config/opencode

# Initialize package.json if it doesn't exist
npm init -y

# Install the plugin package
npm install @opencode-ai/plugin
```

> **Note**: If you're working within the opencode monorepo, this package is already available.

### 2. Copy the tool files

```bash
# Clone this repo (or download the files)
git clone https://github.com/Whiteknight07/opencode-ask-user.git
cd opencode-ask-user

# Create the tool directory if it doesn't exist
mkdir -p ~/.config/opencode/tool

# Copy the tool
cp ask_user.ts ~/.config/opencode/tool/

# Copy the CLI helper (IMPORTANT: outside of tool/ directory)
cp ask-user-cli.ts ~/.config/opencode/
```

> ⚠️ **Important**: The CLI helper must be placed **outside** the `tool/` directory, otherwise opencode will try to load it as a tool and cause display issues.

## Usage

### Step 1: Start the CLI Helper

Open a **separate terminal window** and run:

```bash
bun run ~/.config/opencode/ask-user-cli.ts
```

You'll see:
```
🤖 opencode ask_user CLI
Waiting for questions from the agent...
Press Ctrl+C to exit
────────────────────────────────────────────────────────────
```

### Step 2: Use opencode normally

In your main terminal, run opencode as usual. When the agent calls `ask_user`, the question will appear in the CLI helper terminal.

### Step 3: Respond

- Type your response
- Press **Enter** on an empty line to submit
- Or type `cancel` to cancel the request

## How It Works

The tool uses file-based IPC (Inter-Process Communication):

```
┌──────────────────────────────────────────────────────────────┐
│  opencode (Terminal 1)       │  CLI Helper (Terminal 2)     │
├──────────────────────────────┼───────────────────────────────┤
│  LLM calls ask_user("...")   │  Polling ~/.opencode/ask_user │
│           │                  │         │                     │
│  Write question.json ────────┼────────►│                     │
│           │                  │         ▼                     │
│  Poll for response...        │  Display question to user     │
│           │                  │         │                     │
│           │                  │  User types response          │
│           │◄─────────────────┼──Write response.json          │
│           │                  │                               │
│  Return response to LLM      │                               │
└──────────────────────────────────────────────────────────────┘
```

## Tool Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `question` | string | Yes | The question to ask the user |
| `title` | string | No | Optional title/context for the question |
| `timeout` | number | No | Timeout in seconds (default: 300 = 5 min) |

## Response Format

The tool returns a JSON string:

```json
{
  "responded": true,
  "response": "User's text response here",
  "cancelled": false
}
```

Or if cancelled/timeout:

```json
{
  "responded": false,
  "response": "",
  "cancelled": true,
  "reason": "Timeout after 300 seconds waiting for user response"
}
```

## Troubleshooting

### "Cannot find module '@opencode-ai/plugin'"

Make sure you've installed the plugin:

```bash
cd ~/.config/opencode
npm install @opencode-ai/plugin
```

### Garbled output in opencode TUI

Make sure `ask-user-cli.ts` is placed **outside** the `tool/` directory:

```bash
# Correct location
~/.config/opencode/ask-user-cli.ts  ✅

# Wrong location (will cause issues)
~/.config/opencode/tool/ask-user-cli.ts  ❌
```

### Questions not appearing in CLI

1. Make sure the CLI helper is running in a separate terminal
2. Check that `~/.opencode/ask_user/` directory exists
3. Try restarting the CLI helper

## License

MIT
