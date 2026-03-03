export function LoadingOverlay() {
  return (
    <div className="absolute inset-x-0 bottom-12 flex justify-center z-20 pointer-events-none">
      <div className="bg-zinc-900/95 border border-zinc-800 rounded-2xl px-6 py-4 backdrop-blur-sm flex items-center gap-3 shadow-xl">
        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-zinc-200 text-sm font-medium">
          Researching this location...
        </span>
      </div>
    </div>
  );
}
