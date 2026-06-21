export function extractFilesFromClipboard(data: DataTransfer): File[] {
  if (data.files?.length) return Array.from(data.files);
  return Array.from(data.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((f): f is File => f !== null);
}
