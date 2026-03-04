/**
 * Checks whether a file matches any of the accepted type specifiers.
 * Supports MIME types (image/png), wildcard MIME (image/*), and extensions (.pdf).
 */
export function isFileAccepted(file: File, acceptedTypes: string[]): boolean {
  if (acceptedTypes.length === 0) return true;
  return acceptedTypes.some((type) => {
    if (type.startsWith('.')) {
      return file.name.toLowerCase().endsWith(type.toLowerCase());
    }
    if (type.endsWith('/*')) {
      const category = type.split('/')[0];
      return file.type.startsWith(category + '/');
    }
    return file.type === type;
  });
}
