import { describe, it, expect } from "vitest"
import {
  getSubdomain,
  getRouteGroupForSubdomain,
  getRedirectUrlForSystemRole,
  getDashboardPathForRole,
  canAccessPath,
  canAccessSubdomain,
} from "../subdomain"

describe("getSubdomain", () => {
  it("returns app for app.fiskai.hr", () => {
    expect(getSubdomain("app.fiskai.hr")).toBe("app")
  })

  it("returns marketing for legacy staff.fiskai.hr (will be redirected)", () => {
    // Legacy subdomains return marketing - middleware handles redirect to app.fiskai.hr/staff
    expect(getSubdomain("staff.fiskai.hr")).toBe("marketing")
  })

  it("returns marketing for legacy admin.fiskai.hr (will be redirected)", () => {
    // Legacy subdomains return marketing - middleware handles redirect to app.fiskai.hr/admin
    expect(getSubdomain("admin.fiskai.hr")).toBe("marketing")
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

  it("returns app for localhost (development default)", () => {
    expect(getSubdomain("localhost")).toBe("app")
    expect(getSubdomain("localhost:3000")).toBe("app")
  })
})

describe("getRouteGroupForSubdomain", () => {
  it("maps app subdomain to (app) route group", () => {
    expect(getRouteGroupForSubdomain("app")).toBe("(app)")
  })

  it("maps marketing subdomain to (marketing) route group", () => {
    expect(getRouteGroupForSubdomain("marketing")).toBe("(marketing)")
  })
})

describe("getDashboardPathForRole", () => {
  it("returns /admin for ADMIN role", () => {
    expect(getDashboardPathForRole("ADMIN")).toBe("/admin")
  })

  it("returns /staff for STAFF role", () => {
    expect(getDashboardPathForRole("STAFF")).toBe("/staff")
  })

  it("returns /cc for USER role", () => {
    expect(getDashboardPathForRole("USER")).toBe("/cc")
  })
})

describe("canAccessPath", () => {
  it("allows only ADMIN to access /admin paths", () => {
    expect(canAccessPath("ADMIN", "/admin")).toBe(true)
    expect(canAccessPath("ADMIN", "/admin/tenants")).toBe(true)
    expect(canAccessPath("STAFF", "/admin")).toBe(false)
    expect(canAccessPath("USER", "/admin")).toBe(false)
  })

  it("allows STAFF and ADMIN to access /staff paths", () => {
    expect(canAccessPath("ADMIN", "/staff")).toBe(true)
    expect(canAccessPath("ADMIN", "/staff/clients")).toBe(true)
    expect(canAccessPath("STAFF", "/staff")).toBe(true)
    expect(canAccessPath("STAFF", "/staff/clients")).toBe(true)
    expect(canAccessPath("USER", "/staff")).toBe(false)
  })

  it("allows all authenticated users to access other paths", () => {
    expect(canAccessPath("USER", "/dashboard")).toBe(true)
    expect(canAccessPath("USER", "/invoices")).toBe(true)
    expect(canAccessPath("STAFF", "/dashboard")).toBe(true)
    expect(canAccessPath("ADMIN", "/dashboard")).toBe(true)
  })
})

describe("getRedirectUrlForSystemRole", () => {
  it("redirects ADMIN to app.fiskai.hr/admin", () => {
    const result = getRedirectUrlForSystemRole("ADMIN", "https://app.fiskai.hr/dashboard")
    expect(result).toBe("https://app.fiskai.hr/admin")
  })

  it("redirects STAFF to app.fiskai.hr/staff", () => {
    const result = getRedirectUrlForSystemRole("STAFF", "https://app.fiskai.hr/dashboard")
    expect(result).toBe("https://app.fiskai.hr/staff")
  })

  it("redirects USER to app.fiskai.hr/cc", () => {
    const result = getRedirectUrlForSystemRole("USER", "https://app.fiskai.hr/invoices")
    expect(result).toBe("https://app.fiskai.hr/cc")
  })

  it("handles legacy subdomain URLs by converting to app subdomain", () => {
    expect(getRedirectUrlForSystemRole("ADMIN", "https://admin.fiskai.hr/old")).toBe(
      "https://app.fiskai.hr/admin"
    )
    expect(getRedirectUrlForSystemRole("STAFF", "https://staff.fiskai.hr/old")).toBe(
      "https://app.fiskai.hr/staff"
    )
  })
})

describe("canAccessSubdomain", () => {
  it("allows all roles to access app subdomain", () => {
    expect(canAccessSubdomain("ADMIN", "app")).toBe(true)
    expect(canAccessSubdomain("STAFF", "app")).toBe(true)
    expect(canAccessSubdomain("USER", "app")).toBe(true)
  })

  it("allows all to access marketing subdomain (public)", () => {
    expect(canAccessSubdomain("ADMIN", "marketing")).toBe(true)
    expect(canAccessSubdomain("STAFF", "marketing")).toBe(true)
    expect(canAccessSubdomain("USER", "marketing")).toBe(true)
  })
})
