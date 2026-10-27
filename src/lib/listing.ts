export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE = DEFAULT_PAGE_SIZE;
const allowedLimits = new Set([5, 10, 20]);

export function listingParams(input: { q?: string | string[]; page?: string | string[]; limit?: string | string[] }) {
  const rawQuery = Array.isArray(input.q) ? input.q[0] : input.q;
  const rawPage = Array.isArray(input.page) ? input.page[0] : input.page;
  const rawLimit = Array.isArray(input.limit) ? input.limit[0] : input.limit;
  const query = (rawQuery ?? "").trim().slice(0, 100);
  const parsedPage = Number(rawPage);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const requestedLimit = Number(rawLimit);
  const limit = allowedLimits.has(requestedLimit) ? requestedLimit : DEFAULT_PAGE_SIZE;
  return { query, page, limit, offset: (page - 1) * limit };
}
