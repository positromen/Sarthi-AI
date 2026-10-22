# Contributing to Sarthi AI

Thanks for helping. Bug reports, fixes, translations and new features are all welcome.

## Before you start
- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Privacy is the core promise. A change must never make Sarthi visible in a screen share, put an API key in the
  renderer or a log, or send user data anywhere except the provider the user chose.

## Set up
1. Install [Node.js](https://nodejs.org) 22 or newer on Windows 10 2004+ or Windows 11.
2. Fork and clone the repository, then run `npm install` in `app/`.
3. Run `npm run dev`. You need your own Deepgram, Gemini and Groq keys (all have free tiers).

## Conventions
- **TypeScript strict** everywhere. Shared types and IPC channel names live in `app/src/shared/`.
- **Network and secrets stay in main.** The renderer reaches main only through the typed `window.sarthi` bridge in
  `app/src/preload/index.ts`. Add a channel to `shared/ipc.ts` and a typed preload method; never use `ipcRenderer`
  directly in the renderer. Validate every value that arrives from a window.
- **No native `title` tooltips** in the UI. Windows draws them outside the protected window, so a screen share would
  show them. `app/src/renderer/privacy.test.ts` enforces this.
- **Test first for logic.** Pure rules (parsing, prompts, routing, formatting) get Vitest tests next to the file.
  Providers are tested against fake `fetch` responses, never live APIs.
- Match the surrounding style: small functions, comments that explain *why*, no dead code.

## Before opening a pull request
Run these in `app/`; all three must pass:

```powershell
npm run typecheck
npm test
npm run build
```

Then:
- Describe what changed and why, and link the issue.
- Include a screenshot for UI changes.
- Say how you tested anything that only shows up in the real app (audio, hotkeys, screen share).

## Commit messages
Use the imperative mood and say what the change does: `Add Hindi to the answer languages`, not
`added languages`. Keep the first line under about 70 characters and explain the reason in the body.

## License
By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
