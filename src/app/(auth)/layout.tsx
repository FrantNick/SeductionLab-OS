export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember text-base font-bold text-white">
            SL
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-white">Seduction Lab OS</h1>
            <p className="text-xs text-zinc-500">Marketing experimentation &amp; attribution</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
