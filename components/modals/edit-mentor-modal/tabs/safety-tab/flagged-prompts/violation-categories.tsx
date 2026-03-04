interface ViolationCategoriesProps {
  categories: string[];
}

export function ViolationCategories({ categories }: ViolationCategoriesProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <span
            key={category}
            className="px-3 py-1 bg-gray-100 text-gray-900 text-sm rounded-md hover:bg-gray-200 cursor-pointer"
          >
            {category}
          </span>
        ))}
      </div>
    </div>
  );
}
