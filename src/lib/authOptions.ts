import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly', access_type: 'offline', prompt: 'consent' } },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, user }) {
      if (account) { token.accessToken = account.access_token; token.userId = user?.email || token.email || '' }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string|undefined
      session.user.id = token.userId as string || session.user.email || ''
      return session
    },
  },
  pages: { signIn: '/', error: '/' },
}
