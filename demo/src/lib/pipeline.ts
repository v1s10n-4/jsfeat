/**
 * Pipeline engine -- manages an ordered list of processing stages.
 */

export interface PipelineStage {
  /** Unique instance id. */
  id: string;
  /** References StageDefinition.id from the registry. */
  stageId: string;
  /** Current control values for this stage instance. */
  params: Record<string, any>;
}

/**
 * Creates the default "Trading Card Detection" pipeline.
 */
export function createDefaultPipeline(): PipelineStage[] {
  return [
    { id: crypto.randomUUID(), stageId: 'grayscale', params: {} },
    { id: crypto.randomUUID(), stageId: 'gaussianBlur', params: { kernelSize: 5, sigma: 1.5 } },
    { id: crypto.randomUUID(), stageId: 'canny', params: { low: 30, high: 80 } },
    { id: crypto.randomUUID(), stageId: 'fastCorners', params: { threshold: 40, border: 3 } },
  ];
}
