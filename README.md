This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment variables

AI brand analysis (`/api/analyze-brand`) needs **either** an OpenAI key **or** an Anthropic (Claude) key:

1. Copy `.env.example` to `.env.local`.
2. Set **`OPENAI_API_KEY`** ([OpenAI](https://platform.openai.com/api-keys)) and/or **`ANTHROPIC_API_KEY`** ([Anthropic](https://console.anthropic.com/settings/keys)). You can use **`CLAUDE_API_KEY`** as an alias for the Anthropic key.
3. Restart `npm run dev`.

**Which provider runs:** if only one key is set, that provider is used. If **both** are set, **OpenAI is used by default**; set **`BRAND_AI_PROVIDER=anthropic`** (or `claude`) to force Claude.

Optional models: `OPENAI_MODEL` (default `gpt-4o-mini`), `ANTHROPIC_MODEL` or `CLAUDE_MODEL` (default `claude-3-5-haiku-20241022`). On Vercel or other hosts, add the same variables in the project’s environment settings.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
