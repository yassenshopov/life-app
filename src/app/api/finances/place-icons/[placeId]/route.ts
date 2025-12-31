import { createIconRouteHandler } from '@/lib/icon-routes';

export const GET = createIconRouteHandler({
  tableName: 'finances_places',
  bucketName: 'finances-place-icons',
  idParamName: 'placeId',
});

