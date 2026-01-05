/**
 * Helper function to extract property value from Notion API property objects
 * @param property - The Notion property object
 * @param propertyType - The type of the property (e.g., 'title', 'rich_text', 'select', etc.)
 * @returns The extracted value based on the property type
 */
export function getPropertyValue(property: any, propertyType: string): any {
  if (!property) return null;

  switch (propertyType) {
    case 'title':
      return property.title?.[0]?.plain_text || '';
    case 'rich_text':
      return property.rich_text?.[0]?.plain_text || '';
    case 'select':
      return property.select?.name || null;
    case 'multi_select':
      return property.multi_select?.map((item: any) => item.name) || [];
    case 'status':
      return property.status?.name || null;
    case 'date':
      if (property.date?.start) {
        return property.date.start;
      }
      return null;
    case 'number':
      return property.number;
    case 'checkbox':
      return property.checkbox || false;
    case 'people':
      return property.people || [];
    case 'relation':
      return property.relation || [];
    case 'formula':
      if (property.formula?.type === 'date' && property.formula.date) {
        return property.formula.date.start || null;
      }
      if (property.formula?.type === 'number') {
        return property.formula.number;
      }
      if (property.formula?.type === 'string') {
        return property.formula.string;
      }
      return null;
    default:
      return null;
  }
}

