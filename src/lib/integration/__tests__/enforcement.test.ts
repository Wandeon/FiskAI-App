/**
 * Tests for Phase 5 Enforcement Module
 *
 * These tests verify that:
 * 1. Legacy paths are blocked when FF_ENFORCE_INTEGRATION_ACCOUNT=true
 * 2. Legacy paths are allowed when FF_ENFORCE_INTEGRATION_ACCOUNT=false
 * 3. IntegrationRequiredError has correct P0 severity
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  IntegrationRequiredError,
  assertLegacyPathAllowed,
  assertWorkerHasIntegration,
  isEnforcementActive,
} from "../enforcement"

// Mock the feature flags module
vi.mock("@/lib/integration-feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
}))

// Mock logger to avoid console noise
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

import { isFeatureEnabled } from "@/lib/integration-feature-flags"

const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

describe("IntegrationRequiredError", () => {
  it("has P0 severity", () => {
    const error = new IntegrationRequiredError("FISCALIZATION", "company-123", "test reason")

    expect(error.severity).toBe("P0")
    expect(error.name).toBe("IntegrationRequiredError")
  })

  it("includes operation, companyId, and reason in message", () => {
    const error = new IntegrationRequiredError(
      "EINVOICE_SEND",
      "company-456",
      "No integrationAccountId provided"
    )

    expect(error.message).toContain("EINVOICE_SEND")
    expect(error.message).toContain("company-456")
    expect(error.message).toContain("No integrationAccountId provided")
    expect(error.message).toContain("FF_ENFORCE_INTEGRATION_ACCOUNT=true")
  })

  it("exposes operation, companyId, and reason as properties", () => {
    const error = new IntegrationRequiredError(
      "WORKER_JOB",
      "company-789",
      "Worker requires integrationAccountId"
    )

    expect(error.operation).toBe("WORKER_JOB")
    expect(error.companyId).toBe("company-789")
    expect(error.reason).toBe("Worker requires integrationAccountId")
  })
})

describe("assertLegacyPathAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("when enforcement is DISABLED (FF_ENFORCE_INTEGRATION_ACCOUNT=false)", () => {
    beforeEach(() => {
      mockIsFeatureEnabled.mockReturnValue(false)
    })

    it("allows FISCALIZATION legacy path", () => {
      expect(() => {
        assertLegacyPathAllowed("FISCALIZATION", "company-123", {
          requestId: "req-1",
        })
      }).not.toThrow()
    })

    it("allows EINVOICE_SEND legacy path", () => {
      expect(() => {
        assertLegacyPathAllowed("EINVOICE_SEND", "company-123", {
          invoiceId: "inv-1",
        })
      }).not.toThrow()
    })

    it("allows EINVOICE_RECEIVE legacy path", () => {
      expect(() => {
        assertLegacyPathAllowed("EINVOICE_RECEIVE", "company-123", {
          provider: "eposlovanje",
        })
      }).not.toThrow()
    })

    it("allows WORKER_JOB legacy path", () => {
      expect(() => {
        assertLegacyPathAllowed("WORKER_JOB", "company-123", {
          workerName: "test-worker",
        })
      }).not.toThrow()
    })
  })

  describe("when enforcement is ENABLED (FF_ENFORCE_INTEGRATION_ACCOUNT=true)", () => {
    beforeEach(() => {
      mockIsFeatureEnabled.mockReturnValue(true)
    })

    it("throws IntegrationRequiredError for FISCALIZATION", () => {
      expect(() => {
        assertLegacyPathAllowed("FISCALIZATION", "company-123", {
          requestId: "req-1",
        })
      }).toThrow(IntegrationRequiredError)

      try {
        assertLegacyPathAllowed("FISCALIZATION", "company-123", {})
      } catch (error) {
        expect(error).toBeInstanceOf(IntegrationRequiredError)
        expect((error as IntegrationRequiredError).operation).toBe("FISCALIZATION")
        expect((error as IntegrationRequiredError).companyId).toBe("company-123")
        expect((error as IntegrationRequiredError).severity).toBe("P0")
      }
    })

    it("throws IntegrationRequiredError for EINVOICE_SEND", () => {
      expect(() => {
        assertLegacyPathAllowed("EINVOICE_SEND", "company-456", {
          invoiceId: "inv-1",
        })
      }).toThrow(IntegrationRequiredError)
    })

    it("throws IntegrationRequiredError for EINVOICE_RECEIVE", () => {
      expect(() => {
        assertLegacyPathAllowed("EINVOICE_RECEIVE", "company-789", {
          provider: "eposlovanje",
        })
      }).toThrow(IntegrationRequiredError)
    })

    it("throws IntegrationRequiredError for WORKER_JOB", () => {
      expect(() => {
        assertLegacyPathAllowed("WORKER_JOB", "company-000", {
          workerName: "test-worker",
        })
      }).toThrow(IntegrationRequiredError)
    })
  })
})

describe("assertWorkerHasIntegration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("when enforcement is DISABLED", () => {
    beforeEach(() => {
      mockIsFeatureEnabled.mockReturnValue(false)
    })

    it("allows worker without integrationAccountId", () => {
      expect(() => {
        assertWorkerHasIntegration("company-123", null, "test-worker")
      }).not.toThrow()
    })

    it("allows worker with integrationAccountId", () => {
      expect(() => {
        assertWorkerHasIntegration("company-123", "ia-456", "test-worker")
      }).not.toThrow()
    })
  })

  describe("when enforcement is ENABLED", () => {
    beforeEach(() => {
      mockIsFeatureEnabled.mockReturnValue(true)
    })

    it("throws when integrationAccountId is null", () => {
      expect(() => {
        assertWorkerHasIntegration("company-123", null, "inbound-poller")
      }).toThrow(IntegrationRequiredError)
    })

    it("throws when integrationAccountId is undefined", () => {
      expect(() => {
        assertWorkerHasIntegration("company-123", undefined, "fiscal-worker")
      }).toThrow(IntegrationRequiredError)
    })

    it("allows when integrationAccountId is provided", () => {
      expect(() => {
        assertWorkerHasIntegration("company-123", "ia-456", "test-worker")
      }).not.toThrow()
    })

    it("includes worker name in error message", () => {
      try {
        assertWorkerHasIntegration("company-123", null, "special-worker")
      } catch (error) {
        expect(error).toBeInstanceOf(IntegrationRequiredError)
        expect((error as IntegrationRequiredError).reason).toContain("special-worker")
      }
    })
  })
})

describe("isEnforcementActive", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns true when enforcement flag is enabled", () => {
    mockIsFeatureEnabled.mockReturnValue(true)
    expect(isEnforcementActive()).toBe(true)
  })

  it("returns false when enforcement flag is disabled", () => {
    mockIsFeatureEnabled.mockReturnValue(false)
    expect(isEnforcementActive()).toBe(false)
  })
})

describe("Legacy path blocking - integration scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("blocks fiscal V1 path when enforcement is enabled", () => {
    mockIsFeatureEnabled.mockReturnValue(true)

    // Simulates the enforcement check at the start of executeFiscalRequestV1
    expect(() => {
      assertLegacyPathAllowed("FISCALIZATION", "company-fiscal-001", {
        requestId: "fr-001",
        certificateId: "cert-legacy",
      })
    }).toThrow(IntegrationRequiredError)
  })

  it("blocks e-invoice send legacy path when enforcement is enabled", () => {
    mockIsFeatureEnabled.mockReturnValue(true)

    // Simulates the enforcement check at the start of sendViaLegacyPath
    expect(() => {
      assertLegacyPathAllowed("EINVOICE_SEND", "company-einv-001", {
        invoiceId: "inv-001",
        provider: "eposlovanje",
      })
    }).toThrow(IntegrationRequiredError)
  })

  it("blocks e-invoice inbound V1 path when enforcement is enabled", () => {
    mockIsFeatureEnabled.mockReturnValue(true)

    // Simulates the enforcement check at the start of pollInboundV1
    expect(() => {
      assertLegacyPathAllowed("EINVOICE_RECEIVE", "company-poll-001", {
        path: "pollInboundV1",
        provider: "eposlovanje",
      })
    }).toThrow(IntegrationRequiredError)
  })
})
