// src/lib/email-sync/providers/gmail.ts

import { google } from 'googleapis'
import type { EmailSyncProvider } from '../provider'
import type { TokenResult, MessageBatch, EmailMessage } from '../types'

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
}

export const gmailProvider: EmailSyncProvider = {
  name: 'gmail',

  getAuthUrl(redirectUri: string, state: string): string {
    const oauth2Client = getOAuth2Client()
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      redirect_uri: redirectUri,
      state,
      prompt: 'consent',
    })
  },

  async exchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
    const oauth2Client = getOAuth2Client()
    oauth2Client.redirectUri = redirectUri

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received - user may need to revoke and reconnect')
    }

    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
      scopes: SCOPES,
    }
  },

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const { credentials } = await oauth2Client.refreshAccessToken()

    return {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token || refreshToken,
      expiresAt: new Date(credentials.expiry_date || Date.now() + 3600 * 1000),
      scopes: SCOPES,
    }
  },

  async fetchMessages(accessToken: string, cursor?: string): Promise<MessageBatch> {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'has:attachment',
      maxResults: 50,
      pageToken: cursor,
    })

    const messages: EmailMessage[] = []

    for (const msg of response.data.messages || []) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      })

      const headers = detail.data.payload?.headers || []
      const fromHeader = headers.find(h => h.name === 'From')?.value || ''
      const subjectHeader = headers.find(h => h.name === 'Subject')?.value || ''
      const dateHeader = headers.find(h => h.name === 'Date')?.value || ''

      // Extract email from "Name <email>" format
      const emailMatch = fromHeader.match(/<([^>]+)>/) || [null, fromHeader]
      const senderEmail = emailMatch[1] || fromHeader

      const attachments = (detail.data.payload?.parts || [])
        .filter(part => part.filename && part.body?.attachmentId)
        .map(part => ({
          id: part.body!.attachmentId!,
          filename: part.filename!,
          mimeType: part.mimeType || 'application/octet-stream',
          sizeBytes: part.body!.size || 0,
        }))

      if (attachments.length > 0) {
        messages.push({
          id: msg.id!,
          receivedAt: new Date(dateHeader || detail.data.internalDate || Date.now()),
          senderEmail,
          subject: subjectHeader,
          attachments,
        })
      }
    }

    return {
      messages,
      nextCursor: response.data.nextPageToken || undefined,
    }
  },

  async downloadAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string
  ): Promise<Buffer> {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    })

    const data = response.data.data
    if (!data) {
      throw new Error('No attachment data received')
    }

    // Gmail returns base64url encoded data
    return Buffer.from(data, 'base64url')
  },

  async revokeAccess(accessToken: string): Promise<void> {
    const oauth2Client = getOAuth2Client()
    await oauth2Client.revokeToken(accessToken)
  },
}
