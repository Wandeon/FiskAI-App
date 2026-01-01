// src/lib/pos/thermal-printer.ts
/**
 * Thermal Receipt Printer Integration
 * Supports ESC/POS printers via WebUSB and network connections
 */

// WebUSB type declarations for environments that don't have them
declare global {
  interface Navigator {
    usb?: USB
  }
  interface USB {
    requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>
  }
  interface USBDeviceRequestOptions {
    filters: USBDeviceFilter[]
  }
  interface USBDeviceFilter {
    vendorId?: number
    productId?: number
    classCode?: number
    subclassCode?: number
    protocolCode?: number
    serialNumber?: string
  }
  interface USBDevice {
    configuration: USBConfiguration | null
    open(): Promise<void>
    close(): Promise<void>
    selectConfiguration(configurationValue: number): Promise<void>
    claimInterface(interfaceNumber: number): Promise<void>
    transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>
  }
  interface USBConfiguration {
    interfaces: USBInterface[]
  }
  interface USBInterface {
    interfaceNumber: number
    alternate: USBAlternateInterface
  }
  interface USBAlternateInterface {
    endpoints: USBEndpoint[]
  }
  interface USBEndpoint {
    endpointNumber: number
    direction: "in" | "out"
    type: "bulk" | "interrupt" | "isochronous"
  }
  interface USBOutTransferResult {
    bytesWritten: number
    status: "ok" | "stall" | "babble"
  }
}

// ESC/POS command constants
export const ESC_POS = {
  // Initialize printer
  INIT: new Uint8Array([0x1b, 0x40]),

  // Text formatting
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),

  // Font size
  NORMAL_SIZE: new Uint8Array([0x1d, 0x21, 0x00]),
  DOUBLE_HEIGHT: new Uint8Array([0x1d, 0x21, 0x01]),
  DOUBLE_WIDTH: new Uint8Array([0x1d, 0x21, 0x10]),
  DOUBLE_SIZE: new Uint8Array([0x1d, 0x21, 0x11]),

  // Font style
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),
  UNDERLINE_ON: new Uint8Array([0x1b, 0x2d, 0x01]),
  UNDERLINE_OFF: new Uint8Array([0x1b, 0x2d, 0x00]),

  // Line feed and cut
  LINE_FEED: new Uint8Array([0x0a]),
  FEED_LINES: (n: number) => new Uint8Array([0x1b, 0x64, n]),
  PARTIAL_CUT: new Uint8Array([0x1d, 0x56, 0x01]),
  FULL_CUT: new Uint8Array([0x1d, 0x56, 0x00]),

  // Cash drawer
  OPEN_DRAWER: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),

  // QR Code commands
  QR_MODEL: new Uint8Array([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]), // Model 2
  QR_SIZE: (size: number) => new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size]),
  QR_ERROR: new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]), // Error correction L
  QR_STORE: (data: Uint8Array) => {
    const len = data.length + 3
    const header = new Uint8Array([
      0x1d,
      0x28,
      0x6b,
      len & 0xff,
      (len >> 8) & 0xff,
      0x31,
      0x50,
      0x30,
    ])
    const result = new Uint8Array(header.length + data.length)
    result.set(header, 0)
    result.set(data, header.length)
    return result
  },
  QR_PRINT: new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
} as const

export type PrinterPaperWidth = 58 | 80

export interface PrinterConfig {
  paperWidth: PrinterPaperWidth
  encoding: "cp852" | "utf-8" // CP852 for Croatian characters
  charsPerLine: number
}

export const PAPER_CONFIGS: Record<PrinterPaperWidth, PrinterConfig> = {
  58: { paperWidth: 58, encoding: "cp852", charsPerLine: 32 },
  80: { paperWidth: 80, encoding: "cp852", charsPerLine: 48 },
}

export interface ThermalPrinter {
  connect(): Promise<boolean>
  disconnect(): Promise<void>
  isConnected(): boolean
  print(data: Uint8Array): Promise<void>
  getPaperWidth(): PrinterPaperWidth
}

/**
 * WebUSB Thermal Printer implementation
 * Works in Chrome, Edge, and other Chromium-based browsers
 */
export class WebUSBPrinter implements ThermalPrinter {
  private device: USBDevice | null = null
  private endpointOut: number | null = null
  private paperWidth: PrinterPaperWidth

  constructor(paperWidth: PrinterPaperWidth = 80) {
    this.paperWidth = paperWidth
  }

  async connect(): Promise<boolean> {
    if (!navigator.usb) {
      console.error("WebUSB not supported in this browser")
      return false
    }

    try {
      // Request USB device - common thermal printer vendor IDs
      this.device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x0416 }, // Winbond (common thermal printer chipset)
          { vendorId: 0x0483 }, // STMicroelectronics
          { vendorId: 0x04b8 }, // Epson
          { vendorId: 0x0519 }, // Star Micronics
          { vendorId: 0x0dd4 }, // Custom
          { vendorId: 0x154f }, // SNBC
          { vendorId: 0x0fe6 }, // ICS (common thermal printer)
          { vendorId: 0x1fc9 }, // NXP (common POS printer chipset)
          { vendorId: 0x1a86 }, // QinHeng Electronics (CH340/CH341)
        ],
      })

      await this.device.open()

      // Select configuration if needed
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1)
      }

      // Find the interface and endpoint
      const iface = this.device.configuration?.interfaces[0]
      if (iface) {
        await this.device.claimInterface(iface.interfaceNumber)

        // Find bulk OUT endpoint
        const endpoint = iface.alternate.endpoints.find(
          (ep) => ep.direction === "out" && ep.type === "bulk"
        )
        if (endpoint) {
          this.endpointOut = endpoint.endpointNumber
        }
      }

      return this.endpointOut !== null
    } catch (error) {
      console.error("Failed to connect to USB printer:", error)
      return false
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.close()
      } catch {
        // Ignore close errors
      }
      this.device = null
      this.endpointOut = null
    }
  }

  isConnected(): boolean {
    return this.device !== null && this.endpointOut !== null
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.device || this.endpointOut === null) {
      throw new Error("Printer not connected")
    }

    await this.device.transferOut(this.endpointOut, data as BufferSource)
  }

  getPaperWidth(): PrinterPaperWidth {
    return this.paperWidth
  }
}

/**
 * Network Printer implementation
 * For Ethernet/WiFi connected printers (Star, Epson TM-T88, etc.)
 */
export class NetworkPrinter implements ThermalPrinter {
  private connected = false
  private readonly host: string
  private readonly port: number
  private paperWidth: PrinterPaperWidth

  constructor(host: string, port = 9100, paperWidth: PrinterPaperWidth = 80) {
    this.host = host
    this.port = port
    this.paperWidth = paperWidth
  }

  async connect(): Promise<boolean> {
    // Network printer connection is stateless - just validate
    // Actual connection happens on print via backend API
    this.connected = true
    return true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.connected) {
      throw new Error("Printer not connected")
    }

    // Send via server-side API route that has network access
    const response = await fetch("/api/pos/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: this.host,
        port: this.port,
        data: Array.from(data),
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Network print failed: ${error}`)
    }
  }

  getPaperWidth(): PrinterPaperWidth {
    return this.paperWidth
  }
}

/**
 * Browser Print Dialog fallback
 * Uses browser's print dialog with thermal receipt styling
 */
export class BrowserPrintFallback implements ThermalPrinter {
  private paperWidth: PrinterPaperWidth

  constructor(paperWidth: PrinterPaperWidth = 80) {
    this.paperWidth = paperWidth
  }

  async connect(): Promise<boolean> {
    return true // Always available
  }

  async disconnect(): Promise<void> {
    // No-op
  }

  isConnected(): boolean {
    return true
  }

  async print(_data: Uint8Array): Promise<void> {
    // Convert ESC/POS data to HTML and open print dialog
    // This is a fallback - actual ESC/POS commands are ignored
    // The receipt should be pre-rendered as HTML
    throw new Error("BrowserPrintFallback requires HTML content. Use printHtml() instead.")
  }

  getPaperWidth(): PrinterPaperWidth {
    return this.paperWidth
  }

  /**
   * Print HTML content using browser print dialog
   */
  printHtml(html: string): void {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      throw new Error("Could not open print window")
    }

    const widthMm = this.paperWidth
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Racun</title>
          <style>
            @page {
              size: ${widthMm}mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 10pt;
              width: ${widthMm}mm;
              margin: 0;
              padding: 2mm;
              box-sizing: border-box;
            }
            .receipt {
              width: 100%;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .double { font-size: 14pt; }
            .line { border-top: 1px dashed #000; margin: 4px 0; }
            .item-row { display: flex; justify-content: space-between; }
            @media print {
              body { print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${html}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }
}

/**
 * Encode string to CP852 (Croatian codepage) for thermal printers
 */
export function encodeCP852(str: string): Uint8Array {
  // CP852 character mapping for Croatian special characters
  const cp852Map: Record<string, number> = {
    C: 0x80, // Č -> Ć position (close approximation)
    c: 0x87, // č -> ć position
    S: 0xe6, // Š
    s: 0x98, // š
    Z: 0xa6, // Ž
    z: 0xa7, // ž
    D: 0xd0, // Đ (approximation)
    d: 0xd1, // đ (approximation)
    "\u0106": 0x8f, // Ć
    "\u0107": 0x86, // ć
    "\u010c": 0xac, // Č
    "\u010d": 0x9f, // č
    "\u0110": 0xd0, // Đ
    "\u0111": 0xd1, // đ
    "\u0160": 0xe6, // Š
    "\u0161": 0x98, // š
    "\u017d": 0xa6, // Ž
    "\u017e": 0xa7, // ž
  }

  const result: number[] = []
  for (const char of str) {
    if (cp852Map[char] !== undefined) {
      result.push(cp852Map[char])
    } else if (char.charCodeAt(0) < 128) {
      result.push(char.charCodeAt(0))
    } else {
      // Fallback to ASCII approximation or ?
      result.push(0x3f) // ?
    }
  }
  return new Uint8Array(result)
}
