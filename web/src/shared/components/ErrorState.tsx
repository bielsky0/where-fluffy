interface ErrorStateAction {
  label: string;
  onClick: () => void;
}

interface ErrorStateProps {
  icon: string;
  title: string;
  message: string;
  action: ErrorStateAction;
  secondaryAction?: ErrorStateAction;
  // Full-viewport, centered on its own page (PetDetailPage/NotFoundPage/ServerErrorPage) vs. a
  // compact block meant to sit inside an already-scrollable container (MapExplorerPage's
  // BottomSheet drawer, FeedList, MainFeedPage's urgent carousel) — same tokens either way, just
  // without claiming the whole screen.
  fullscreen?: boolean;
}

export function ErrorState({ icon, title, message, action, secondaryAction, fullscreen = false }: ErrorStateProps) {
  return (
    <div
      className={
        fullscreen
          ? 'flex h-[100dvh] flex-col items-center justify-center gap-3 bg-white px-6 text-center'
          : 'flex flex-col items-center justify-center gap-3 px-6 py-8 text-center'
      }
    >
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
      <p className="text-base font-bold text-neutral-900">{title}</p>
      <p className="text-sm text-neutral-400">{message}</p>
      <button
        type="button"
        onClick={action.onClick}
        className="mt-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white"
      >
        {action.label}
      </button>
      {secondaryAction && (
        <button type="button" onClick={secondaryAction.onClick} className="text-sm font-semibold text-neutral-500 underline">
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}
