import { createIconRouteHandler } from '@/lib/icon-routes';

export const GET = createIconRouteHandler({
  tableName: 'finances_assets',
  bucketName: 'finances-icons',
  idParamName: 'assetId',
});

