// src/lib/email-sync/providers/microsoft.ts

import { ConfidentialClientApplication } from "@azure/msal-node"
import { Client } from "@microsoft/microsoft-graph-client"
import type { EmailSyncProvider } from "../provider"
import type { TokenResult, MessageBatch, EmailMessage } from "../types"

const SCOPES = ["Mail.Read", "offline_access"]

function getMsalClient() {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authority: "https://login.microsoftonline.com/common",
    },
  })
}

export const microsoftProvider: EmailSyncProvider = {
  name: "microsoft",

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state,
      prompt: "consent",
    })
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
  },

  async exchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
    const msalClient = getMsalClient()

    const result = await msalClient.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri,
    })

    if (!result) {
      throw new Error("Failed to exchange code for tokens")
    }

    // Get refresh token via token cache
    const accounts = await msalClient.getTokenCache().getAllAccounts()
    const account = accounts[0]

    // For refresh token, we need to use the silent flow later
    // Store the account info as the "refresh token"
    const refreshData = JSON.stringify({
      homeAccountId: account?.homeAccountId,
      tenantId: account?.tenantId,
    })

    return {
      accessToken: result.accessToken,
      refreshToken: refreshData,
      expiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
      scopes: SCOPES,
    }
  },

  async refreshToken(refreshTokenData: string): Promise<TokenResult> {
    const msalClient = getMsalClient()

    // Parse stored account data
    const { homeAccountId, tenantId } = JSON.parse(refreshTokenData)

    const result = await msalClient.acquireTokenSilent({
      scopes: SCOPES,
      account: {
        homeAccountId,
        tenantId,
        environment: "login.microsoftonline.com",
        username: "",
        localAccountId: "",
      },
    })

    return {
      accessToken: result.accessToken,
      refreshToken: refreshTokenData,
      expiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
      scopes: SCOPES,
    }
  },

  async fetchMessages(accessToken: string, cursor?: string): Promise<MessageBatch> {
    const client = Client.init({
      authProvider: (done) => done(null, accessToken),
    })

    let request = client
      .api("/me/messages")
      .filter("hasAttachments eq true")
      .select("id,receivedDateTime,from,subject")
      .expand("attachments($select=id,name,contentType,size)")
      .top(50)

    if (cursor) {
      request = client.api(cursor)
    }

    const response = await request.get()

    // Microsoft Graph API message response types
    interface MSGraphAttachment {
      id: string
      name: string
      contentType: string
      size: number
    }

    interface MSGraphMessage {
      id: string
      receivedDateTime: string
      from?: { emailAddress?: { address?: string } }
      subject?: string
      attachments?: MSGraphAttachment[]
    }

    const messages: EmailMessage[] = ((response.value || []) as MSGraphMessage[]).map((msg) => ({
      id: msg.id,
      receivedAt: new Date(msg.receivedDateTime),
      senderEmail: msg.from?.emailAddress?.address || "",
      subject: msg.subject || "",
      attachments: (msg.attachments || []).map((att) => ({
        id: att.id,
        filename: att.name,
        mimeType: att.contentType || "application/octet-stream",
        sizeBytes: att.size || 0,
      })),
    }))

    return {
      messages,
      nextCursor: response["@odata.nextLink"],
    }
  },

  async downloadAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string
  ): Promise<Buffer> {
    const client = Client.init({
      authProvider: (done) => done(null, accessToken),
    })

    const response = await client.api(`/me/messages/${messageId}/attachments/${attachmentId}`).get()

    if (!response.contentBytes) {
      throw new Error("No attachment content received")
    }

    return Buffer.from(response.contentBytes, "base64")
  },

  async revokeAccess(_accessToken: string): Promise<void> {
    // Microsoft doesn't have a simple revoke endpoint
    // User must revoke via https://account.microsoft.com/privacy/app-access
    // This is a no-op
  },
}
