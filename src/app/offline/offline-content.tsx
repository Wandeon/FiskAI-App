"use client"

export function OfflineContent() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">Niste spojeni na internet</h1>
        <p className="text-muted-foreground mb-6">
          Provjerite svoju internetsku vezu i pokušajte ponovo.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Pokušaj ponovo
        </button>
      </div>
    </div>
  )
}
