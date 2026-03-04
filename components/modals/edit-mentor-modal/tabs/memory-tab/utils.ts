export const transformCategoryToApi = (displayCategory: string): string => {
  return displayCategory.toLowerCase().replace(' ', '_');
};

export const transformCategoryToDisplay = (apiCategory: string): string => {
  return apiCategory
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
