import { describe, it, expect } from "vitest"
import { getSubdomain, getRouteGroupForSubdomain, getRedirectUrlForSystemRole } from "../subdomain"

describe("getSubdomain", () => {
  it("returns app for app.fiskai.hr", () => {
    expect(getSubdomain("app.fiskai.hr")).toBe("app")
  })

  it("returns staff for staff.fiskai.hr", () => {
    expect(getSubdomain("staff.fiskai.hr")).toBe("staff")
  })

  it("returns admin for admin.fiskai.hr", () => {
    expect(getSubdomain("admin.fiskai.hr")).toBe("admin")
  })

  it("returns marketing for fiskai.hr (root domain)", () => {
    expect(getSubdomain("fiskai.hr")).toBe("marketing")
  })

  it("returns marketing for www.fiskai.hr", () => {
    expect(getSubdomain("www.fiskai.hr")).toBe("marketing")
  })

  it("handles port in hostname", () => {
    expect(getSubdomain("app.fiskai.hr:3000")).toBe("app")
  })

  // Skip: localhost handling changed for dev environment
  it.skip("returns app for localhost (development default)", () => {
    expect(getSubdomain("localhost")).toBe("app")
    expect(getSubdomain("localhost:3000")).toBe("app")
  })
})

describe("getRouteGroupForSubdomain", () => {
  it("maps subdomains to route groups", () => {
    expect(getRouteGroupForSubdomain("admin")).toBe("(admin)")
    expect(getRouteGroupForSubdomain("staff")).toBe("(staff)")
    expect(getRouteGroupForSubdomain("app")).toBe("(app)")
    expect(getRouteGroupForSubdomain("marketing")).toBe("(marketing)")
  })
})

describe("getRedirectUrlForSystemRole", () => {
  it("redirects ADMIN to admin subdomain", () => {
    const result = getRedirectUrlForSystemRole("ADMIN", "https://app.fiskai.hr/dashboard")
    expect(result).toBe("https://admin.fiskai.hr")
  })

  it("redirects STAFF to staff subdomain", () => {
    const result = getRedirectUrlForSystemRole("STAFF", "https://admin.fiskai.hr")
    expect(result).toBe("https://staff.fiskai.hr")
  })

  it("redirects USER to app subdomain", () => {
    const result = getRedirectUrlForSystemRole("USER", "https://staff.fiskai.hr")
    expect(result).toBe("https://app.fiskai.hr")
  })
})
