import { ModuleKey, MODULES, getDependencies } from "./definitions"

export interface ModuleAccess {
  hasModule: (moduleKey: ModuleKey) => boolean
  getEnabledModules: () => ModuleKey[]
  canAccessRoute: (pathname: string) => boolean
  getModuleForRoute: (pathname: string) => ModuleKey | null
  getMissingDependencies: (moduleKey: ModuleKey) => ModuleKey[]
  getDependentModules: (moduleKey: ModuleKey) => ModuleKey[]
}

export function createModuleAccess(entitlements: string[]): ModuleAccess {
  const enabledModules = new Set(entitlements as ModuleKey[])

  function hasModule(moduleKey: ModuleKey): boolean {
    // First check if the module itself is enabled
    if (!enabledModules.has(moduleKey)) {
      return false
    }

    // Then check if all dependencies are enabled
    const dependencies = getDependencies(moduleKey)
    return dependencies.every((dep) => enabledModules.has(dep))
  }

  function getEnabledModules(): ModuleKey[] {
    return Array.from(enabledModules)
  }

  function getModuleForRoute(pathname: string): ModuleKey | null {
    // Normalize pathname - remove trailing slash, handle dynamic segments
    const normalizedPath = pathname.replace(/\/$/, "").replace(/\/[^\/]+$/, "/[id]")

    for (const [key, module] of Object.entries(MODULES)) {
      for (const route of module.routes) {
        // Check exact match
        if (pathname === route || pathname.startsWith(route + "/")) {
          return key as ModuleKey
        }
        // Check dynamic route match
        if (normalizedPath === route) {
          return key as ModuleKey
        }
      }
    }
    return null
  }

  function canAccessRoute(pathname: string): boolean {
    const moduleKey = getModuleForRoute(pathname)
    // If route doesn't belong to any module, allow access
    if (!moduleKey) return true
    // Check if module is enabled
    return hasModule(moduleKey)
  }

  function getMissingDependencies(moduleKey: ModuleKey): ModuleKey[] {
    const dependencies = getDependencies(moduleKey)
    return dependencies.filter((dep) => !enabledModules.has(dep))
  }

  function getDependentModules(moduleKey: ModuleKey): ModuleKey[] {
    const dependents: ModuleKey[] = []
    for (const [key, module] of Object.entries(MODULES)) {
      if (module.depends?.includes(moduleKey) && enabledModules.has(key as ModuleKey)) {
        dependents.push(key as ModuleKey)
      }
    }
    return dependents
  }

  return {
    hasModule,
    getEnabledModules,
    canAccessRoute,
    getModuleForRoute,
    getMissingDependencies,
    getDependentModules,
  }
}
