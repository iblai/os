import { useSearchParams } from "next/navigation";

export function useEmbedMode() {
  const searchParams = useSearchParams();
  return searchParams.get('embed') === 'true';
}