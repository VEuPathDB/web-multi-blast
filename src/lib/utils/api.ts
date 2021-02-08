import { arrayOf, string } from '@veupathdb/wdk-client/lib/Utils/Json';
import {
  BoundApiRequestsObject,
  createFetchApiRequestHandler,
  createJsonRequest,
  standardTransformer,
} from '@veupathdb/web-common/lib/util/api';

import {
  IoBlastConfig,
  createJobResponse,
  longJobResponse,
  multiQueryReportJson,
  shortJobResponse,
} from './ServiceTypes';

export function createBlastRequestHandler(
  baseBlastUrl: string,
  fetchApi?: Window['fetch']
) {
  return createFetchApiRequestHandler({
    baseUrl: baseBlastUrl,
    init: {
      headers: {
        'Auth-Key': getAuthKey(),
      },
    },
    fetchApi,
  });
}

const JOBS_PATH = '/jobs';

export const apiRequests = {
  // FIXME: Should jobs be filterable by site?
  fetchJobList: function () {
    return {
      path: JOBS_PATH,
      method: 'GET',
      transformResponse: standardTransformer(arrayOf(shortJobResponse)),
    };
  },
  createJob: function (
    site: string,
    targets: { organism: string; target: string }[],
    config: IoBlastConfig
  ) {
    return createJsonRequest({
      path: JOBS_PATH,
      method: 'POST',
      body: {
        site,
        targets,
        config,
      },
      transformResponse: standardTransformer(createJobResponse),
    });
  },
  fetchJob: function (jobId: string) {
    return {
      path: `${JOBS_PATH}/${jobId}`,
      method: 'GET',
      transformResponse: standardTransformer(longJobResponse),
    };
  },
  fetchSingleFileJsonReport: function (jobId: string) {
    return {
      path: `${JOBS_PATH}/${jobId}/report?format=single-file-json&zip=false&inline=true`,
      method: 'GET',
      transformResponse: standardTransformer(multiQueryReportJson),
    };
  },
  fetchQuery: function (jobId: string) {
    return {
      path: `${JOBS_PATH}/${jobId}/query?download=false`,
      method: 'GET',
      transformResponse: standardTransformer(string),
    };
  },
};

export type BlastApi = BoundApiRequestsObject<typeof apiRequests>;

// FIXME: Update createRequestHandler to accommodate responses
// with "attachment" Content-Disposition
export function createQueryDownloader(baseBlastUrl: string) {
  return async function downloadQuery(jobId: string) {
    const response = await fetch(
      `${baseBlastUrl}/jobs/${jobId}/query?download=true`,
      { headers: { 'Auth-Key': getAuthKey() } }
    );

    const contentDisposition = response.headers.get('content-disposition');

    if (!contentDisposition?.startsWith('attachment')) {
      console.warn('Ignoring attempted download of a non-file query.');
      return;
    }

    const blob = await response.blob();

    const filenameMatch = contentDisposition.match(/filename="(.*)"/);

    const filename =
      filenameMatch == null || filenameMatch.length < 1
        ? 'query.txt'
        : filenameMatch[1];

    // Adapted from https://stackoverflow.com/a/42274086
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); // we need to append the element to the dom -> otherwise it will not work in firefox
    a.click();
    a.remove(); //afterwards we remove the element again
  };
}

function getAuthKey() {
  const wdkCheckAuth =
    document.cookie.split('; ').find((x) => x.startsWith('wdk_check_auth=')) ??
    '';
  const authKey = wdkCheckAuth.replace('wdk_check_auth=', '');

  return authKey;
}
