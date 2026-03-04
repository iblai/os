export async function handleError(error: any, tenantKey?: string) {
  console.error(JSON.stringify({ tenant: tenantKey, error }));
}
