import { useAppStore, type ActiveLookup } from '@/store/index.js';
import { Loader2, X } from 'lucide-react';

const position = (anchor: { x: number; y: number }): React.CSSProperties => ({
  position: 'fixed',
  left: anchor.x,
  top: anchor.y,
  transform: 'translateX(-50%)',
  zIndex: 50,
});

export const TranslationPopover = () => {
  const active = useAppStore((s) => s.activeLookup);
  const clear = useAppStore((s) => s.clearActiveLookup);
  if (!active) return null;

  return (
    <div
      style={position(active.anchor)}
      className="bg-popover text-popover-foreground border rounded-lg shadow-md w-80 max-w-[90vw] p-3 text-sm"
      role="dialog"
    >
      <button
        className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground"
        onClick={clear}
        aria-label="Close"
      >
        <X size={14} />
      </button>
      <Body active={active} />
    </div>
  );
};

const Body = ({ active }: { active: NonNullable<ActiveLookup> }) => {
  if (active.status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={14} /> Translating…
      </div>
    );
  }
  if (active.status === 'error') {
    return <div className="text-destructive">{active.errorMessage ?? 'Translation failed'}</div>;
  }
  const p = active.payload!;
  if (p.kind === 'dictionary') {
    return (
      <div className="space-y-1">
        <div className="font-medium">{p.translation}</div>
        <div className="text-xs text-muted-foreground">
          {p.lemma}
          {p.partOfSpeech ? ` · ${p.partOfSpeech}` : ''}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="font-medium">{p.translation}</div>
      {p.lemma && <div className="text-xs text-muted-foreground">lemma: {p.lemma}</div>}
      {p.grammarNotes && <div className="text-xs">{p.grammarNotes}</div>}
      {p.examples && p.examples.length > 0 && (
        <ul className="text-xs space-y-1 border-l pl-2">
          {p.examples.map((e, i) => (
            <li key={i}>
              <div className="italic">{e.source}</div>
              <div className="text-muted-foreground">{e.translation}</div>
            </li>
          ))}
        </ul>
      )}
      {p.alternativeTranslations && p.alternativeTranslations.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Also: {p.alternativeTranslations.join(', ')}
        </div>
      )}
    </div>
  );
};
