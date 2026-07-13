import { motion } from 'framer-motion';

// Phone mockup is built from plain CSS/SVG (border-radius frame + gradient/blocks standing in
// for a real screenshot) rather than an image asset — no photo/mockup files exist in the repo
// yet (see Hero.tsx's own comment on the same gap). Swap the inner content for a real screenshot
// `<img>` later without touching the frame/tilt/float wrapper.
export function ShowcaseSection() {
  return (
    <section className="flex flex-col items-center gap-10 bg-white px-6 py-20 sm:flex-row sm:justify-center sm:gap-14">
      <motion.div
        className="shrink-0 [perspective:1200px]"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="relative aspect-[9/19] w-56 overflow-hidden rounded-[2.5rem] border-[6px] border-ink bg-white shadow-xl [transform:rotate3d(0.3,1,0,16deg)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,#FFD9E1,transparent_60%),linear-gradient(180deg,#F7F7F7,#ffffff)]" />
          <div className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-coral text-lg shadow-md">
            📍
          </div>
          <div className="absolute inset-x-4 bottom-4 flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-md">
            <div className="h-2 w-2/3 rounded-full bg-gray-200" />
            <div className="h-2 w-1/2 rounded-full bg-gray-200" />
          </div>
        </div>
      </motion.div>

      <div className="flex max-w-sm flex-col gap-3 text-center sm:text-left">
        <h2 className="text-2xl font-bold text-ink">Twoje zgłoszenie prezentuje się na mapie</h2>
        <p className="text-sm text-subtle">
          Zdjęcia, lokalizacja i cechy szczególne są prezentowane automatycznie. Każdy, kto otworzy
          mapę w Twojej okolicy, zobaczy Twojego pupila.
        </p>
      </div>
    </section>
  );
}
