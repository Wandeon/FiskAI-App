// src/lib/email-sync/provider.ts

import type { TokenResult, MessageBatch } from './types'

export interface EmailSyncProvider {
  name: string

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(redirectUri: string, state: string): string

  /**
   * Exchange authorization code for tokens
   */
  exchangeCode(code: string, redirectUri: string): Promise<TokenResult>

  /**
   * Refresh expired access token
   */
  refreshToken(refreshToken: string): Promise<TokenResult>

  /**
   * Fetch messages with attachments since cursor
   */
  fetchMessages(accessToken: string, cursor?: string): Promise<MessageBatch>

  /**
   * Download attachment content
   */
  downloadAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string
  ): Promise<Buffer>

  /**
   * Revoke tokens on disconnect
   */
  revokeAccess(accessToken: string): Promise<void>
}
