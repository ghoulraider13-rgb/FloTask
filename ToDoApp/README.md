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
- Primary model: `nvidia/nemotron-3.5-lightning-30b-a3b`
- API Key: Set `NVIDIA_API_KEY` in `.env` or Vercel environment variables
- Architecture: Server-mediated — all NLM calls go through `/api/chat` server endpoint (Vite dev middleware or Vercel serverless function). The client never directly accesses the NVIDIA API.

**Environment Variables:**
- `NVIDIA_API_KEY` - Your NVIDIA API key (required for NLM functionality)
- `GEMINI_API_KEY` - Legacy Gemini key (no longer used; client-direct Gemini calls removed)

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
