import 'dotenv/config'

export const env = {
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 3001,
  githubToken: process.env.GITHUB_TOKEN || undefined,
  geminiApiKey: process.env.GEMINI_API_KEY || undefined,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
}
