"use client"

import { useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { importBankStatement } from "../actions"
import { useRouter } from "next/navigation"
import type { BankAccount } from "@prisma/client"
import type { SupportedBank } from "@/lib/banking/csv-parser"

type ImportFormProps = {
  accounts: Pick<BankAccount, "id" | "name" | "iban">[]
}

type PreviewTransaction = {
  date: string
  description: string
  amount: number
  balance: number
  reference?: string
  counterpartyName?: string
  counterpartyIban?: string
}

export function ImportForm({ accounts }: ImportFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id || "")
  const [selectedBank, setSelectedBank] = useState<SupportedBank>("generic")
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<PreviewTransaction[] | null>(null)

  function parseCSV(csvText: string): PreviewTransaction[] {
    const lines = csvText.trim().split("\n")
    if (lines.length < 2) {
      throw new Error("CSV datoteka je prazna ili nema podataka")
    }

    // Parse header
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const dateIndex = header.findIndex((h) => h === "datum" || h === "date")
    const descIndex = header.findIndex((h) => h === "opis" || h === "description")
    const amountIndex = header.findIndex((h) => h === "iznos" || h === "amount")
    const balanceIndex = header.findIndex((h) => h === "stanje" || h === "balance")
    const refIndex = header.findIndex((h) => h === "referenca" || h === "reference")
    const counterpartyIndex = header.findIndex(
      (h) => h === "protivna_strana" || h === "counterparty"
    )
    const ibanIndex = header.findIndex((h) => h === "protivni_iban" || h === "counterparty_iban")

    if (dateIndex === -1 || descIndex === -1 || amountIndex === -1 || balanceIndex === -1) {
      throw new Error("CSV datoteka mora sadržavati stupce: datum, opis, iznos, stanje")
    }

    // Parse data rows
    const transactions: PreviewTransaction[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(",").map((v) => v.trim())

      const transaction: PreviewTransaction = {
        date: values[dateIndex],
        description: values[descIndex],
        amount: parseFloat(values[amountIndex]),
        balance: parseFloat(values[balanceIndex]),
      }

      if (refIndex !== -1 && values[refIndex]) {
        transaction.reference = values[refIndex]
      }
      if (counterpartyIndex !== -1 && values[counterpartyIndex]) {
        transaction.counterpartyName = values[counterpartyIndex]
      }
      if (ibanIndex !== -1 && values[ibanIndex]) {
        transaction.counterpartyIban = values[ibanIndex]
      }

      // Validate
      if (
        !transaction.date ||
        !transaction.description ||
        isNaN(transaction.amount) ||
        isNaN(transaction.balance)
      ) {
        throw new Error(`Nevažeći podaci u retku ${i + 1}`)
      }

      transactions.push(transaction)
    }

    if (transactions.length === 0) {
      throw new Error("Nema valjanih transakcija u datoteci")
    }

    return transactions
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setFileName(null)
      setPreviewData(null)
      return
    }

    setFileName(file.name)
    setError(null)
    setSuccess(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string
        const parsed = parseCSV(csvText)
        setPreviewData(parsed)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Greška pri parsiranju CSV datoteke")
        setPreviewData(null)
      }
    }
    reader.readAsText(file)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!previewData || previewData.length === 0) {
      setError("Nema podataka za uvoz")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData()
    formData.append("accountId", selectedAccount)
    formData.append("fileName", fileName || "imported.csv")
    formData.append("transactions", JSON.stringify(previewData))
    formData.append("bank", selectedBank)

    const result = await importBankStatement(formData)

    if (result.success && "data" in result) {
      const count = result.data?.count ?? 0
      const message = [`Uspješno uvezeno ${count} transakcija`]
      const autoMatched = result.data?.autoMatchedCount ?? 0
      if (autoMatched > 0) {
        message.push(`AI je automatski povezao ${autoMatched} transakcija`)
      }
      setSuccess(message.join(" · "))
      setPreviewData(null)
      setFileName(null)
      // Reset file input
      const fileInput = document.getElementById("csvFile") as HTMLInputElement
      if (fileInput) fileInput.value = ""

      // Redirect to transactions page after success
      setTimeout(() => {
        router.push("/banking/transactions")
      }, 2000)
    } else {
      setError(result.error || "Greška pri uvozu transakcija")
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-danger-bg border border-danger-border text-danger-text px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-success-bg border border-success-border text-success-text px-4 py-3 rounded">
          {success}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="accountId">Bankovni račun *</Label>
          <select
            id="accountId"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full rounded-md border border-default px-3 py-2 text-sm"
            required
            disabled={loading}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.iban})
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="csvFile">CSV datoteka *</Label>
          <input
            id="csvFile"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full text-sm"
            required
            disabled={loading}
          />
          <p className="text-xs text-secondary mt-1">
            Odaberite CSV datoteku s bankovnim transakcijama
          </p>
        </div>

        <div>
          <Label htmlFor="bankName">Banka (format CSV-a)</Label>
          <select
            id="bankName"
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value as SupportedBank)}
            className="w-full rounded-md border border-default px-3 py-2 text-sm"
            disabled={loading}
          >
            <option value="generic">Generički</option>
            <option value="erste">Erste</option>
            <option value="raiffeisenbank">Raiffeisenbank</option>
            <option value="moja-banka">Moja banka</option>
            <option value="splitska">Splitska</option>
            <option value="otp">OTP</option>
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Ispravno parsiranje prema formatu banke.
          </p>
        </div>
      </div>

      {/* Preview */}
      {previewData && previewData.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-surface-1 px-4 py-2 border-b">
            <p className="text-sm font-semibold">Pregled: {previewData.length} transakcija</p>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-surface-1 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary">Datum</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary">Opis</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-secondary">Iznos</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary">Ref</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary">
                    Protivna strana
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {previewData.slice(0, 100).map((txn, idx) => (
                  <tr key={idx} className="hover:bg-surface-1">
                    <td className="px-3 py-2 text-xs">
                      {new Date(txn.date).toLocaleDateString("hr-HR")}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-xs truncate">{txn.description}</td>
                    <td
                      className={`px-3 py-2 text-xs text-right font-mono ${
                        txn.amount >= 0 ? "text-success-text" : "text-danger-text"
                      }`}
                    >
                      {txn.amount >= 0 ? "+" : ""}
                      {txn.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[120px] truncate">
                      {txn.reference || "-"}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-xs truncate">
                      {txn.counterpartyName || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 100 && (
              <div className="px-4 py-2 bg-surface-1 text-xs text-secondary text-center">
                Prikazano prvih 100 od {previewData.length} transakcija
              </div>
            )}
          </div>
        </div>
      )}

      {previewData && previewData.length > 0 && (
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Uvoz u tijeku..." : `Uvezi ${previewData.length} transakcija`}
        </Button>
      )}
    </form>
  )
}
