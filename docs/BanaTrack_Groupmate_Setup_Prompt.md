# BanaTrack — Groupmate Setup Prompt

Give this to your groupmate along with the GitHub repo link. Steps for THEM to do:

1. Clone the repo: `git clone <your-repo-url>`
2. Open the cloned folder in VS Code
3. Install Claude Code the same way you did (see BanaTrack setup notes), then run `claude` in that folder and log in using the shared Pro Gmail + password
4. Once at the Claude Code prompt, paste the entire message below as their first message

---

## Message for them to paste into Claude Code

We just cloned this BanaTrack capstone project from GitHub onto a new machine, and I'm not very experienced with development tools, so please automate as much of this setup as you can and explain anything I need to do manually in plain terms.

Please:
1. Check whether Node.js, npm, and Git are installed on this machine and tell me their versions. If any are missing, install them automatically if you're able to (e.g. via winget on Windows or Homebrew on Mac); if you can't install them directly, give me the exact command or a link to run/download myself.
2. Once Node and npm are confirmed working, go into the `web` folder and run `npm install` to install all the project's dependencies.
3. Check if `web/.env.local.example` exists. If `web/.env.local` doesn't exist yet, create it from that example file and tell me exactly which values I still need to fill in — I'll get the actual Supabase URL and key from my group lead separately, not from you.
4. Once dependencies are installed and the env file is in place, try running `npm run dev` inside `web` and tell me whether it starts without errors, and what URL to open in my browser to see it.
5. If anything fails or is missing along the way, walk me through fixing it step by step, assuming I have no prior development experience.

---

**One thing they'll still need from you directly (not from Claude Code):** the actual Supabase Project URL, anon key, and service role key (`SUPABASE_SERVICE_ROLE_KEY`, needed for the admin Users page) values, since those are secret and intentionally not included in the GitHub repo. The service role key has full database access — send it privately and never paste it anywhere public. Send those to them separately (chat app, email, etc.) so they can paste them into their own `.env.local` once Claude Code creates it.
