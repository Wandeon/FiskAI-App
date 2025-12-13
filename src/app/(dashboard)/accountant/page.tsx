import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EInvoiceStatus, ExpenseStatus, SupportTicketStatus } from "@prisma/client"

const currency = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" })
const dateFmt = (value?: Date | null) => (value ? value.toLocaleDateString("hr-HR") : "—")

export default async function AccountantWorkspacePage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const unpaidWhere = {
    companyId: company.id,
    paidAt: null,
    status: { notIn: [EInvoiceStatus.DRAFT, EInvoiceStatus.REJECTED, EInvoiceStatus.ARCHIVED] },
  }

  const expensesMissingDocsWhere = {
    companyId: company.id,
    OR: [{ receiptUrl: null }, { receiptUrl: "" }],
  }

  const expensesUnpaidWhere = {
    companyId: company.id,
    status: { not: ExpenseStatus.PAID },
  }

  const [
    unpaidCount,
    unpaidInvoices,
    missingDocsCount,
    expensesMissingDocs,
    unpaidExpensesCount,
    unpaidExpenses,
    openTicketCount,
    recentTickets,
    myTickets,
    unassignedTickets,
  ] = await Promise.all([
    db.eInvoice.count({ where: unpaidWhere }),
    db.eInvoice.findMany({
      where: unpaidWhere,
      orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        buyer: { select: { name: true } },
        totalAmount: true,
        status: true,
      },
    }),
    db.expense.count({ where: expensesMissingDocsWhere }),
    db.expense.findMany({
      where: expensesMissingDocsWhere,
      orderBy: { date: "desc" },
      take: 5,
      select: {
        id: true,
        description: true,
        date: true,
        totalAmount: true,
        vendor: { select: { name: true } },
        status: true,
        receiptUrl: true,
      },
    }),
    db.expense.count({ where: expensesUnpaidWhere }),
    db.expense.findMany({
      where: expensesUnpaidWhere,
      orderBy: { date: "desc" },
      take: 5,
      select: {
        id: true,
        description: true,
        date: true,
        totalAmount: true,
        vendor: { select: { name: true } },
        status: true,
        receiptUrl: true,
      },
    }),
    db.supportTicket.count({
      where: {
        companyId: company.id,
        status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
      },
    }),
    db.supportTicket.findMany({
      where: {
        companyId: company.id,
        status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        assignedToId: true,
      },
    }),
    db.supportTicket.findMany({
      where: {
        companyId: company.id,
        assignedToId: user.id!,
        status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        assignedToId: true,
      },
    }),
    db.supportTicket.findMany({
      where: {
        companyId: company.id,
        assignedToId: null,
        status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        assignedToId: true,
      },
    }),
  ])

  const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0)
  const missingDocsTotal = expensesMissingDocs.reduce((sum, exp) => sum + Number(exp.totalAmount || 0), 0)
  const unpaidExpensesTotal = unpaidExpenses.reduce((sum, exp) => sum + Number(exp.totalAmount || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Računovođa — rad u istom sustavu</p>
        <h1 className="text-2xl font-bold">Accountant workspace</h1>
        <p className="text-muted-foreground">
          Pregled otvorenih stavki bez eksportanja: neplaćeni računi, troškovi bez dokaza i troškovi za knjiženje.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Neplaćeni računi</CardTitle>
            <CardDescription>Računi poslani kupcima koji još nisu označeni kao plaćeni.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold">{unpaidCount}</p>
            <p className="text-sm text-muted-foreground">Otvoreno: {currency.format(unpaidTotal)}</p>
            <Link href="/e-invoices" className="text-sm font-semibold text-primary hover:underline">
              Pregledaj e-račune →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Troškovi bez dokaza</CardTitle>
            <CardDescription>Nedostaje račun/slika za knjiženje troška.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold">{missingDocsCount}</p>
            <p className="text-sm text-muted-foreground">Iznos: {currency.format(missingDocsTotal)}</p>
            <Link href="/expenses" className="text-sm font-semibold text-primary hover:underline">
              Otvori troškove →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Troškovi za knjiženje</CardTitle>
            <CardDescription>Status nije PLAĆENO ili nedostaje datum plaćanja.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold">{unpaidExpensesCount}</p>
            <p className="text-sm text-muted-foreground">Iznos: {currency.format(unpaidExpensesTotal)}</p>
            <Link href="/expenses" className="text-sm font-semibold text-primary hover:underline">
              Pregledaj troškove →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ticketi klijenata</CardTitle>
            <CardDescription>Otvoreni / u radu u ovom trenutku.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold">{openTicketCount}</p>
            <p className="text-sm text-muted-foreground">Komunikacija ostaje u aplikaciji.</p>
            <Link href="/support" className="text-sm font-semibold text-primary hover:underline">
              Otvori ticket centar →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Najhitniji računi</CardTitle>
            <CardDescription>Sortirano po dospijeću, bez eksportanja.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {unpaidInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nema otvorenih računa.</p>
            ) : (
              unpaidInvoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/e-invoices/${invoice.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      {invoice.invoiceNumber} • {invoice.buyer?.name ?? "Nepoznat kupac"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Izdano {dateFmt(invoice.issueDate)} · Dospijeće {dateFmt(invoice.dueDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">
                      {invoice.status}
                    </Badge>
                    <p className="text-sm font-semibold">{currency.format(Number(invoice.totalAmount || 0))}</p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Troškovi za akciju</CardTitle>
            <CardDescription>Prioritet: bez dokaza ili bez statusa plaćanja.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...expensesMissingDocs, ...unpaidExpenses]
              .filter((exp, index, arr) => arr.findIndex((e) => e.id === exp.id) === index)
              .slice(0, 5)
              .map((expense) => {
                const needsReceipt = !expense.receiptUrl
                const needsPayment = expense.status !== "PAID"
                return (
                <Link
                  key={expense.id}
                  href={`/expenses/${expense.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      {expense.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {expense.vendor?.name ?? "Dobavljač nije zabilježen"} • {dateFmt(expense.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">
                      {needsReceipt ? "Nedostaje račun" : needsPayment ? expense.status : "Spremno"}
                    </Badge>
                    <p className="text-sm font-semibold">{currency.format(Number(expense.totalAmount || 0))}</p>
                  </div>
                </Link>
                )
              })}

            {expensesMissingDocs.length + unpaidExpenses.length === 0 && (
              <p className="text-sm text-muted-foreground">Nema troškova za obradu.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ticketi / zahtjevi klijenata</CardTitle>
          <CardDescription>Računovođa odgovara i vodi status unutar FiskAI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nema otvorenih ticketa.</p>
          ) : (
            recentTickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/support/${ticket.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 transition hover:bg-muted/50"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{ticket.title}</p>
                  <p className="text-xs text-muted-foreground">Zadnja promjena {dateFmt(ticket.updatedAt)}</p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {ticket.status === "OPEN"
                    ? "Otvoreno"
                    : ticket.status === "IN_PROGRESS"
                      ? "U radu"
                      : ticket.status === "RESOLVED"
                        ? "Riješeno"
                        : "Zatvoreno"}
                </Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ticketi dodijeljeni meni</CardTitle>
            <CardDescription>Brzi pregled onoga što čeka tvoj odgovor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {myTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nema dodijeljenih ticketa.</p>
            ) : (
              myTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/support/${ticket.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground">Zadnja promjena {dateFmt(ticket.updatedAt)}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {ticket.status === "OPEN" ? "Otvoreno" : "U radu"}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nedodijeljeni ticketi</CardTitle>
            <CardDescription>Preuzmi i dodijeli da klijent ne čeka.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {unassignedTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nema nedodijeljenih ticketa.</p>
            ) : (
              unassignedTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/support/${ticket.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground">Zadnja promjena {dateFmt(ticket.updatedAt)}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {ticket.status === "OPEN" ? "Otvoreno" : "U radu"}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brzi linkovi za računovođu</CardTitle>
          <CardDescription>Radite direktno u sustavu, bez slanja CSV-ova.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Link href="/contacts" className="rounded-full bg-muted px-3 py-1 font-semibold text-foreground hover:bg-muted/80">
            Kontakti / kupci
          </Link>
          <Link href="/expenses/categories" className="rounded-full bg-muted px-3 py-1 font-semibold text-foreground hover:bg-muted/80">
            Kategorije troškova
          </Link>
          <Link href="/reports" className="rounded-full bg-muted px-3 py-1 font-semibold text-foreground hover:bg-muted/80">
            Izvještaji
          </Link>
          <Link href="/banking/import" className="rounded-full bg-muted px-3 py-1 font-semibold text-foreground hover:bg-muted/80">
            Uvoz banke (CSV)
          </Link>
          <Link href="/settings" className="rounded-full bg-muted px-3 py-1 font-semibold text-foreground hover:bg-muted/80">
            Postavke tvrtke
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
