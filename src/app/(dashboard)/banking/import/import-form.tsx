'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { importBankStatement } from '../actions'
import { useRouter } from 'next/navigation'
import type { BankAccount } from '@prisma/client'

type ParsedTransaction = {
  date: string
  description: string
  amount: number
  balance: number
  reference?: string
  counterpartyName?: string
  counterpartyIban?: string
}

type ImportFormProps = {
  accounts: Pick<BankAccount, 'id' | 'name' | 'iban'>[]
}

export function ImportForm({ accounts }: ImportFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id || '')
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<ParsedTransaction[] | null>(null)

  function parseCSV(csvText: string): ParsedTransaction[] {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      throw new Error('CSV datoteka je prazna ili nema podataka')
    }

    // Parse header
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const dateIndex = header.findIndex((h) => h === 'datum' || h === 'date')
    const descIndex = header.findIndex((h) => h === 'opis' || h === 'description')
    const amountIndex = header.findIndex((h) => h === 'iznos' || h === 'amount')
    const balanceIndex = header.findIndex((h) => h === 'stanje' || h === 'balance')
    const refIndex = header.findIndex((h) => h === 'referenca' || h === 'reference')
    const counterpartyIndex = header.findIndex(
      (h) => h === 'protivna_strana' || h === 'counterparty'
    )
    const ibanIndex = header.findIndex(
      (h) => h === 'protivni_iban' || h === 'counterparty_iban'
    )

    if (dateIndex === -1 || descIndex === -1 || amountIndex === -1 || balanceIndex === -1) {
      throw new Error(
        'CSV datoteka mora sadržavati stupce: datum, opis, iznos, stanje'
      )
    }

    // Parse data rows
    const transactions: ParsedTransaction[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',').map((v) => v.trim())

      const transaction: ParsedTransaction = {
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
      throw new Error('Nema valjanih transakcija u datoteci')
    }

    return transactions
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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
        setError(err instanceof Error ? err.message : 'Greška pri parsiranju CSV datoteke')
        setPreviewData(null)
      }
    }
    reader.readAsText(file)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!previewData || previewData.length === 0) {
      setError('Nema podataka za uvoz')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData()
    formData.append('accountId', selectedAccount)
    formData.append('fileName', fileName || 'imported.csv')
    formData.append('transactions', JSON.stringify(previewData))

    const result = await importBankStatement(formData)

    if (result.success) {
      setSuccess(
        `Uspješno uvezeno ${result.data?.count} transakcija!`
      )
      setPreviewData(null)
      setFileName(null)
      // Reset file input
      const fileInput = document.getElementById('csvFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      // Redirect to transactions page after success
      setTimeout(() => {
        router.push('/banking/transactions')
      }, 2000)
    } else {
      setError(result.error || 'Greška pri uvozu transakcija')
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
          <p className="text-xs text-gray-500 mt-1">
            Odaberite CSV datoteku s bankovnim transakcijama
          </p>
        </div>
      </div>

      {/* Preview */}
      {previewData && previewData.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <p className="text-sm font-semibold">
              Pregled: {previewData.length} transakcija
            </p>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                    Datum
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                    Opis
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                    Iznos
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                    Stanje
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                    Protivna strana
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previewData.slice(0, 100).map((txn, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs">
                      {new Date(txn.date).toLocaleDateString('hr-HR')}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-xs truncate">
                      {txn.description}
                    </td>
                    <td
                      className={`px-3 py-2 text-xs text-right font-mono ${
                        txn.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {txn.amount >= 0 ? '+' : ''}
                      {txn.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-mono">
                      {txn.balance.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-xs truncate">
                      {txn.counterpartyName || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 100 && (
              <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 text-center">
                Prikazano prvih 100 od {previewData.length} transakcija
              </div>
            )}
          </div>
        </div>
      )}

      {previewData && previewData.length > 0 && (
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Uvoz u tijeku...' : `Uvezi ${previewData.length} transakcija`}
        </Button>
      )}
    </form>
  )
}
