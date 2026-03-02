const DEFAULT_GROUP_SIZE = 4;

/**
 * Returns the active group of keywords for the current rotation index.
 *
 * Why: APIs like JSearch/Adzuna treat "Chef de Projet Manager Coordinateur..."
 * as a literal phrase -> 0 results. Searching each keyword separately, in rotating
 * groups, yields real results and varies the offers each day.
 *
 * @param keywords - Full list of keywords from user preferences
 * @param rotationIndex - Current group index (stored in search_preferences.keyword_rotation_index)
 * @param groupSize - Number of keywords per group (default 4)
 */
export function buildSearchQueries(
  keywords: string[] | undefined,
  rotationIndex: number,
  groupSize = DEFAULT_GROUP_SIZE
): string[] {
  if (!keywords || keywords.length === 0) return [];

  const totalGroups = Math.ceil(keywords.length / groupSize);
  const safeIndex = rotationIndex % totalGroups;
  const start = safeIndex * groupSize;

  return keywords.slice(start, start + groupSize);
}

/**
 * Returns the next rotation index, wrapping back to 0 after all groups are exhausted.
 */
export function nextRotationIndex(
  keywords: string[] | undefined,
  currentIndex: number,
  groupSize = DEFAULT_GROUP_SIZE
): number {
  if (!keywords || keywords.length === 0) return 0;
  const totalGroups = Math.ceil(keywords.length / groupSize);
  return (currentIndex + 1) % totalGroups;
}
