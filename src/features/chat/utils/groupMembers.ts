export const MAX_GROUP_MEMBERS = 50;
export const MAX_CREATE_GROUP_SELECTABLE_MEMBERS = MAX_GROUP_MEMBERS - 1;

export type SectionedListHeader = {
  type: 'header';
  id: string;
  letter: string;
};

export type SectionedListItem<T> =
  | SectionedListHeader
  | {
      type: 'item';
      id: string;
      item: T;
    };

export function getRemainingGroupMemberSlots(currentMemberCount: number): number {
  return Math.max(0, MAX_GROUP_MEMBERS - currentMemberCount);
}

export function isGroupAtCapacity(currentMemberCount: number): boolean {
  return getRemainingGroupMemberSlots(currentMemberCount) === 0;
}

function getSectionLetter(label: string): string {
  const trimmed = label.trim();
  return trimmed.charAt(0).toUpperCase() || '#';
}

export function buildSectionedList<T>(
  items: T[],
  getId: (item: T) => string,
  getLabel: (item: T) => string,
): Array<SectionedListItem<T>> {
  const buckets = new Map<string, T[]>();

  items.forEach((item) => {
    const itemId = getId(item);
    if (!itemId) {
      return;
    }

    const label = getLabel(item).trim();
    const letter = getSectionLetter(label);
    const bucket = buckets.get(letter) ?? [];
    bucket.push(item);
    buckets.set(letter, bucket);
  });

  return Array.from(buckets.keys())
    .sort((left, right) => left.localeCompare(right, 'vi'))
    .flatMap<Array<SectionedListItem<T>>>((letter) => {
      const sectionItems = (buckets.get(letter) ?? [])
        .slice()
        .sort((left, right) => getLabel(left).localeCompare(getLabel(right), 'vi'));

      return [
        {
          type: 'header',
          id: `header-${letter}`,
          letter,
        },
        ...sectionItems.map((item) => ({
          type: 'item' as const,
          id: `item-${getId(item)}`,
          item,
        })),
      ];
    });
}