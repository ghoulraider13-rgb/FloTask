# FloTask - AI-powered task manager

[![Vercel Deployment](https://vercel.com/badge)](https://flotask-xi.vercel.app)

FloTask is an AI-powered task manager that lets you type or speak naturally and tasks schedule themselves. Features include Pomodoro, alarms, scratchpad, and natural language processing via NVIDIA Nemotron models.

## Live Demo

**https://flotask-xi.vercel.app**

## Quick Start

```bash
# Development
uv run vite dev

# Build
npm run build

# Preview
npm run preview
```

## NLM (Natural Language Model) Configuration

FloTask uses NVIDIA's Nemotron models for parsing free-form notes into structured tasks/alarms.

**API Configuration:**
- Primary model: `nvidia/nemotron-3-8b-base-4k`
- Fallback model: `nvidia/nemotron-3-8b-instruct`
- API Key: Set `NVIDIA_API_KEY` in `.env` or Vercel environment variables

**Environment Variables:**
- `NVIDIA_API_KEY` - Your NVIDIA API key (required for NLM functionality)
- `GEMINI_API_KEY` - Legacy Gemini key (still referenced but NVIDIA is primary)

**How it works:**
1. User types/speaks a natural language note (e.g., "Walk the dog tomorrow at 6pm")
2. `buildPrompt()` generates the instruction prompt with current time/timezone
3. `callNemotron()` sends to NVIDIA API with model fallback chain
4. `normalizeActions()` parses the JSON response into structured actions
5. Tasks/alarms are created in the local storage

## Project Structure

```
ToDoApp/
  api/              # Serverless API routes (chat, transform)
  src/              # React frontend
    App.jsx         # Main component
    api/            # API clients
  scripts/          # Build utilities
    kill-sw.mjs     # Post-build SW kill switch
  vit.config.js     # Vite config with PWA support
```

## Development

```bash
# Install dependencies
npm install

# Run dev server
uv run vite dev

# Build for production
npm run build

# Run verify
npm run verify
```

## Deployment

Built with Vite and deployed to Vercel. The build output includes:
- Precached PWA assets (workbox)
- API routes for NLM chat and text transformation
- React component library

## License

MIT
