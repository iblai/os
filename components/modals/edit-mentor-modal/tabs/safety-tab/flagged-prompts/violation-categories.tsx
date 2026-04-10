interface ViolationCategoriesProps {
  categories: string[];
}

export function ViolationCategories({ categories }: ViolationCategoriesProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <span
            key={category}
            className="cursor-pointer rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-900 hover:bg-gray-200"
          >
            {category}
          </span>
        ))}
      </div>
    </div>
  );
}
