/**
 * Waitlist types for gated business types
 * These are stored in the regulatoryCompanionSubscribers table with specific businessType values
 */
export const WAITLIST_TYPES = [
  "drustvo-jdoo", // j.d.o.o. (jednostavno društvo s ograničenom odgovornošću)
  "drustvo-doo", // d.o.o. (društvo s ograničenom odgovornošću)
  "obrt-dohodak", // Obrt na dohodak (non-pausalni)
  "obrt-pdv", // Obrt u sustavu PDV-a
] as const

export type WaitlistType = (typeof WAITLIST_TYPES)[number]
