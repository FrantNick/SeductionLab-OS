export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-brutal border-brutal border-line bg-rust font-display text-base uppercase text-white shadow-hard-sm">
            SL
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl uppercase tracking-wide text-ink">
              Seduction Lab OS
            </h1>
            <p className="mt-1 text-xs text-ink-3">Marketing experimentation &amp; attribution</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
