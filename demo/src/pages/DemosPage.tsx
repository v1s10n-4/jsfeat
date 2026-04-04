import DemoGrid from '@/components/demos/DemoGrid';

export default function DemosPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Demos</h1>
        <p className="text-sm text-muted-foreground">
          Explore individual jsfeat algorithms with live webcam processing.
        </p>
      </div>
      <DemoGrid />
    </div>
  );
}
