import { Routes, Route } from 'react-router-dom';
import TopNav from '@/components/layout/TopNav';
import { lazy, Suspense } from 'react';

const PipelinePage = lazy(() => import('@/pages/PipelinePage'));
const DemosPage = lazy(() => import('@/pages/DemosPage'));
const DemoDetailPage = lazy(() => import('@/pages/DemoDetailPage'));
const DocsPage = lazy(() => import('@/pages/DocsPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TopNav />
      <main className="flex-1">
        <Suspense fallback={<div className="p-8 text-muted-foreground">Loading...</div>}>
          <Routes>
            <Route path="/" element={<PipelinePage />} />
            <Route path="/demos" element={<DemosPage />} />
            <Route path="/demos/:id" element={<DemoDetailPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
