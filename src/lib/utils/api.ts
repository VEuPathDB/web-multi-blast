import { unknown } from '@veupathdb/wdk-client/lib/Utils/Json';
import {
  BoundApiRequestsObject,
  createFetchApiRequestHandler,
  createJsonRequest,
  standardTransformer,
} from '@veupathdb/web-common/lib/util/api';

import { IoBlastConfig } from './ServiceTypes';

export function createBlastRequestHandler(
  baseBlastUrl: string,
  fetchApi?: Window['fetch']
) {
  const wdkCheckAuth =
    document.cookie.split('; ').find((x) => x.startsWith('wdk_check_auth=')) ??
    '';
  const authKey = wdkCheckAuth.replace('wdk_check_auth=', '');

  return createFetchApiRequestHandler({
    baseUrl: baseBlastUrl,
    init: {
      headers: {
        'Auth-Key': authKey,
      },
    },
    fetchApi,
  });
}

const JOBS_PATH = '/jobs';
const META_PATH = '/meta';

export const apiRequests = {
  // FIXME: Should be jobs be filterable by site?
  fetchJobs: function () {
    return {
      path: JOBS_PATH,
      method: 'GET',
      transformResponse: standardTransformer(unknown),
    };
  },
  // FIXME: Remove this hardcoding once the discrepancies between the organism names + target types
  // of the BLAST service and GenesByMultiBlast question parameters have been resolved
  createJob: function (
    site: string = 'PlasmoDB',
    organisms: string = 'Pfalciparum3D7',
    targetType: string = 'Pfalciparum3D7Genome',
    config: IoBlastConfig
  ) {
    return createJsonRequest({
      path: JOBS_PATH,
      method: 'POST',
      body: {
        site,
        organism: organisms,
        'target-type': targetType,
        config,
      },
      transformResponse: standardTransformer(unknown),
    });
  },
  fetchBlastMetadata: function (site: string) {
    return {
      path: `${META_PATH}?site=${site}`,
      method: 'GET',
      transformResponse: standardTransformer(unknown),
    };
  },
};

export type BlastApi = BoundApiRequestsObject<typeof apiRequests>;