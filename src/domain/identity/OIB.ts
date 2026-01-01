// src/domain/identity/OIB.ts
import { IdentityError } from "./IdentityError"

/**
 * Croatian OIB (Osobni Identifikacijski Broj) - Personal Identification Number
 * 11-digit number with Mod 11,10 checksum validation
 *
 * The algorithm:
 * 1. Start with 10 as the initial value
 * 2. For each of the first 10 digits:
 *    a. Add the digit to the current value
 *    b. Take mod 10 (if result is 0, use 10)
 *    c. Multiply by 2
 *    d. Take mod 11
 * 3. The check digit is (11 - final value) mod 10
 */
export class OIB {
  private readonly _value: string

  private constructor(value: string) {
    this._value = value
  }

  static create(value: string): OIB {
    const trimmed = value?.trim() ?? ""

    if (trimmed === "") {
      throw new IdentityError("OIB cannot be empty")
    }

    if (trimmed.length !== 11) {
      throw new IdentityError("OIB must be exactly 11 digits")
    }

    if (!/^\d{11}$/.test(trimmed)) {
      throw new IdentityError("OIB must contain only numeric characters")
    }

    if (!OIB.isValidChecksum(trimmed)) {
      throw new IdentityError("OIB has invalid checksum")
    }

    return new OIB(trimmed)
  }

  /**
   * Validates OIB checksum using Mod 11,10 algorithm (ISO 7064)
   */
  private static isValidChecksum(oib: string): boolean {
    let a = 10

    for (let i = 0; i < 10; i++) {
      const digit = parseInt(oib[i], 10)
      a = a + digit
      a = a % 10
      if (a === 0) {
        a = 10
      }
      a = a * 2
      a = a % 11
    }

    let controlDigit = 11 - a
    if (controlDigit === 10) {
      controlDigit = 0
    }

    return parseInt(oib[10], 10) === controlDigit
  }

  get value(): string {
    return this._value
  }

  equals(other: OIB): boolean {
    return this._value === other._value
  }

  toString(): string {
    return this._value
  }
}
