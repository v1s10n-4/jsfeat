import { testImages, testCategories } from '@/lib/test-manifest';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type Verdict = 'pass' | 'fail' | 'untested';

interface TestImageStripProps {
  selectedImage: string | null;
  onSelectImage: (path: string) => void;
  verdicts: Record<string, Verdict>;
  onRunAll: () => void;
  running: boolean;
  accuracyThreshold: number;
  onAccuracyThresholdChange: (value: number) => void;
  onRetest: () => void;
}

const THUMB_W = 100;
const THUMB_H = 56;

function borderColor(verdict: Verdict): string {
  if (verdict === 'pass') return '#22c55e'; // green-500
  if (verdict === 'fail') return '#ef4444'; // red-500
  return '#6b7280'; // gray-500
}

export default function TestImageStrip({
  selectedImage,
  onSelectImage,
  verdicts,
  onRunAll,
  running,
  accuracyThreshold,
  onAccuracyThresholdChange,
  onRetest,
}: TestImageStripProps) {
  const total = testImages.length;
  const tested = testImages.filter((img) => verdicts[img.path] !== undefined && verdicts[img.path] !== 'untested').length;
  const passCount = testImages.filter((img) => verdicts[img.path] === 'pass').length;
  const failCount = testImages.filter((img) => verdicts[img.path] === 'fail').length;

  return (
    <div className="flex flex-col gap-2">
      {/* Summary bar — all test controls in one compact row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-muted-foreground">Pass:</span>
        <input
          type="number"
          className="w-12 h-5 rounded border border-border bg-background px-1 text-[10px] text-center"
          value={accuracyThreshold}
          onChange={(e) => onAccuracyThresholdChange(Number(e.target.value) || 50)}
          min={5}
          max={500}
        />
        <span className="text-[10px] text-muted-foreground">px</span>
        <span className="text-[10px] text-muted-foreground">&middot;</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
          {tested}/{total} tested
        </Badge>
        <Badge
          className="text-[10px] h-4 px-1.5 bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-400"
        >
          {passCount} pass
        </Badge>
        <Badge
          className="text-[10px] h-4 px-1.5 bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400"
        >
          {failCount} fail
        </Badge>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-5 text-[10px] px-2" onClick={onRetest}>
            Retest
          </Button>
          <Button onClick={onRunAll} disabled={running} variant="default" size="sm" className="h-5 text-[10px] px-2">
            {running ? 'Running\u2026' : 'Run All'}
          </Button>
        </div>
      </div>

      {/* Horizontal scroll strip */}
      <ScrollArea className="w-full whitespace-nowrap rounded-md border border-border/50">
        <div className="flex gap-4 px-2 py-3">
          {testCategories.map((category) => {
            const categoryImages = testImages.filter((img) => img.category === category);
            return (
              <div key={category} className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {category}
                </span>
                <div className="flex gap-1.5">
                  {categoryImages.map((img) => {
                    const verdict: Verdict = verdicts[img.path] ?? 'untested';
                    const isSelected = selectedImage === img.path;
                    return (
                      <button
                        key={img.path}
                        type="button"
                        onClick={() => onSelectImage(img.path)}
                        title={img.filename}
                        style={{
                          position: 'relative',
                          width: THUMB_W,
                          height: THUMB_H,
                          flexShrink: 0,
                          border: `2px solid ${borderColor(verdict)}`,
                          borderRadius: 4,
                          padding: 0,
                          cursor: 'pointer',
                          outline: isSelected ? '2px solid white' : 'none',
                          outlineOffset: isSelected ? 2 : 0,
                          boxShadow: isSelected ? `0 0 0 4px ${borderColor(verdict)}` : undefined,
                          overflow: 'hidden',
                          background: '#111',
                          transition: 'box-shadow 0.1s, outline 0.1s',
                        }}
                        aria-pressed={isSelected}
                        aria-label={`${img.filename} — ${verdict}`}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 1,
                            left: 1,
                            fontSize: 8,
                            lineHeight: '10px',
                            padding: '0 2px',
                            borderRadius: 2,
                            background: img.category === 'paper-bg' ? '#3b82f6' : '#a855f7',
                            color: 'white',
                            fontWeight: 700,
                            zIndex: 1,
                          }}
                        >
                          {img.category === 'paper-bg' ? 'P' : 'W'}
                        </div>
                        <img
                          src={img.path}
                          alt={img.filename}
                          width={THUMB_W}
                          height={THUMB_H}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                          loading="lazy"
                          draggable={false}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
