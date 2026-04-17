import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { getDb } from '@/services/db/index.js';
import type { LookupRow, VocabItemRow } from '@lector/shared';

export const DebugView = () => {
  const [lookups, setLookups] = useState<LookupRow[]>([]);
  const [vocab, setVocab] = useState<VocabItemRow[]>([]);

  const refresh = async () => {
    const db = await getDb();
    setLookups(await db.lookups.list());
    setVocab(await db.vocabItems.listAll());
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Debug</h2>
        <Button onClick={refresh} variant="outline">
          Refresh
        </Button>
      </div>

      <section>
        <h3 className="font-medium mb-2">vocab_items ({vocab.length})</h3>
        <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
          {JSON.stringify(vocab, null, 2)}
        </pre>
      </section>

      <section>
        <h3 className="font-medium mb-2">lookups ({lookups.length})</h3>
        <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
          {JSON.stringify(lookups, null, 2)}
        </pre>
      </section>
    </div>
  );
};
