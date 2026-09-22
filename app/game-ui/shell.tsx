import { AudioToggle } from "@/app/audio-provider";

export function Shell({
  children,
  minimal = false,
}: {
  children: React.ReactNode;
  minimal?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#0d0b1b] text-[#f7f0ff]">
      <div className="stars" />
      <AudioToggle />
      {!minimal && (
        <header
          className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6"
          aria-label="Site header"
        />
      )}
      {children}
    </div>
  );
}
