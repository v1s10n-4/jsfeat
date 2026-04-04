/**
 * A draggable card representing a single pipeline stage.
 * Uses @dnd-kit/sortable for drag-and-drop reordering.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StageControls from './StageControls';
import type { StageDefinition } from '@/lib/stages';
import { cn } from '@/lib/utils';

interface StageCardProps {
  instanceId: string;
  definition: StageDefinition;
  params: Record<string, any>;
  onParamChange: (key: string, value: any) => void;
  onDelete: () => void;
}

export default function StageCard({
  instanceId,
  definition,
  params,
  onParamChange,
  onDelete,
}: StageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: instanceId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      size="sm"
      data-testid="stage-card"
      className={cn(
        'touch-manipulation',
        isDragging && 'opacity-50 ring-2 ring-primary',
      )}
    >
      <CardContent className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>

        {/* Name + controls */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium truncate">{definition.name}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${definition.name}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
          <StageControls
            controls={definition.controls}
            params={params}
            onChange={onParamChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
