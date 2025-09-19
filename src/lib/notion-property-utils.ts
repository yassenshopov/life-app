import { NOTION_PROPERTY_TYPES } from '@/constants/notion-properties';

export function formatPropertyValue(value: any, propertyType: string): string {
  if (!value) return '';

  switch (propertyType) {
    case NOTION_PROPERTY_TYPES.TITLE:
      return value.title?.[0]?.plain_text || '';
    case NOTION_PROPERTY_TYPES.RICH_TEXT:
      return value.rich_text?.[0]?.plain_text || '';
    case NOTION_PROPERTY_TYPES.SELECT:
      return value.select?.name || '';
    case NOTION_PROPERTY_TYPES.MULTI_SELECT:
      return value.multi_select?.map((item: any) => item.name).join(', ') || '';
    case NOTION_PROPERTY_TYPES.DATE:
      return value.date?.start || '';
    case NOTION_PROPERTY_TYPES.PEOPLE:
      return value.people?.map((person: any) => person.name || person).join(', ') || '';
    case NOTION_PROPERTY_TYPES.NUMBER:
      return value.number?.toString() || '';
    case NOTION_PROPERTY_TYPES.CHECKBOX:
      return value.checkbox ? 'Yes' : 'No';
    case NOTION_PROPERTY_TYPES.URL:
      return value.url || '';
    case NOTION_PROPERTY_TYPES.EMAIL:
      return value.email || '';
    case NOTION_PROPERTY_TYPES.PHONE:
      return value.phone_number || '';
    default:
      return String(value);
  }
}

export function createNotionPropertyValue(value: any, propertyType: string): any {
  switch (propertyType) {
    case NOTION_PROPERTY_TYPES.TITLE:
      return {
        title: [{ text: { content: value || '' } }],
      };
    case NOTION_PROPERTY_TYPES.RICH_TEXT:
      return {
        rich_text: [{ text: { content: value || '' } }],
      };
    case NOTION_PROPERTY_TYPES.SELECT:
      return {
        select: value && value !== '' ? { name: value } : null,
      };
    case NOTION_PROPERTY_TYPES.MULTI_SELECT:
      return {
        multi_select: Array.isArray(value) ? value.map((name) => ({ name })) : [],
      };
    case NOTION_PROPERTY_TYPES.DATE:
      return {
        date: value ? { start: value } : null,
      };
    case NOTION_PROPERTY_TYPES.NUMBER:
      return {
        number: value ? parseFloat(value) : null,
      };
    case NOTION_PROPERTY_TYPES.CHECKBOX:
      return {
        checkbox: Boolean(value),
      };
    case NOTION_PROPERTY_TYPES.URL:
      return {
        url: value || null,
      };
    case NOTION_PROPERTY_TYPES.EMAIL:
      return {
        email: value || null,
      };
    case NOTION_PROPERTY_TYPES.PHONE:
      return {
        phone_number: value || null,
      };
    default:
      return value;
  }
}
