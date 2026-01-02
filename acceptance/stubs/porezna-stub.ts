import http from "node:http"

export interface StubPoreznaConfig {
  port?: number
  responses?: {
    submit?: { jir?: string; error?: string }
  }
}

export class StubPoreznaServer {
  private server: http.Server | null = null
  private _baseUrl: string = ""
  private _requestCount: number = 0

  constructor(private config: StubPoreznaConfig) {}

  get baseUrl(): string {
    return this._baseUrl
  }

  get requestCount(): number {
    return this._requestCount
  }

  static async start(config: StubPoreznaConfig = {}): Promise<StubPoreznaServer> {
    const stub = new StubPoreznaServer(config)
    await stub.listen()
    return stub
  }

  private async listen(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this._requestCount++

        if (req.url?.includes("/fiscalize")) {
          res.writeHead(200, { "Content-Type": "application/xml" })
          const jir = this.config.responses?.submit?.jir ?? "stub-jir-12345"
          res.end(`<?xml version="1.0"?><response><jir>${jir}</jir></response>`)
        } else {
          res.writeHead(404)
          res.end()
        }
      })

      // Use ephemeral port (0 = let OS pick)
      this.server.listen(this.config.port ?? 0, () => {
        const addr = this.server!.address()
        const port = typeof addr === "object" ? addr?.port : 0
        this._baseUrl = `http://localhost:${port}`
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve())
      } else {
        resolve()
      }
    })
  }
}
