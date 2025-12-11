import { AsyncLocalStorage } from "node:async_hooks"

export interface RequestContext {
    requestId: string
    userId?: string
    companyId?: string
    path?: string
    method?: string
}

export const contextStore = new AsyncLocalStorage<RequestContext>()

export function getContext(): RequestContext | undefined {
    return contextStore.getStore()
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
    return contextStore.run(context, fn)
}
