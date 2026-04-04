/**
 * Dialog that shows available pipeline stages grouped by category.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { stageCategories } from '@/lib/stages';

interface StagePickerProps {
  onAdd: (stageId: string) => void;
}

export default function StagePicker({ onAdd }: StagePickerProps) {
  const [open, setOpen] = useState(false);

  function handlePick(stageId: string) {
    onAdd(stageId);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        data-testid="add-stage-btn"
        render={
          <Button variant="outline" size="sm" />
        }
      >
        <Plus className="size-4" />
        Add Stage
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Pipeline Stage</DialogTitle>
          <DialogDescription>
            Pick a processing stage to append to the pipeline.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto py-2">
          {Array.from(stageCategories.entries()).map(([category, stages]) => (
            <div key={category}>
              <Badge variant="secondary" className="mb-2">
                {category}
              </Badge>
              <div className="grid grid-cols-2 gap-1.5">
                {stages.map((stage) => (
                  <Button
                    key={stage.id}
                    variant="ghost"
                    size="sm"
                    className="justify-start text-sm"
                    onClick={() => handlePick(stage.id)}
                  >
                    {stage.name}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
