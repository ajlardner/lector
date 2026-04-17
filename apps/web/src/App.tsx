import { Link, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ReaderView } from './views/reader/ReaderView.js';
import { SettingsView } from './views/settings/SettingsView.js';
import { DebugView } from './views/debug/DebugView.js';

export const App = () => (
  <div className="min-h-screen flex flex-col">
    <header className="border-b px-6 py-3 flex items-center gap-6">
      <Link to="/" className="font-semibold text-lg">
        Lector
      </Link>
      <nav className="flex gap-4 text-sm text-muted-foreground">
        <Link to="/">Reader</Link>
        <Link to="/settings">Settings</Link>
        {import.meta.env.DEV && <Link to="/debug">Debug</Link>}
      </nav>
    </header>
    <main className="flex-1">
      <Routes>
        <Route path="/" element={<ReaderView />} />
        <Route path="/settings" element={<SettingsView />} />
        {import.meta.env.DEV && <Route path="/debug" element={<DebugView />} />}
      </Routes>
    </main>
    <Toaster richColors position="bottom-right" />
  </div>
);
