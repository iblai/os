export type CanvasOpenPayload = {
  title: string;
  content: string;
  toolType: string;
  artifactId?: number;
  org?: string;
  userId?: string;
  fileExtension?: string;
  metadata?: Record<string, unknown>;
};
