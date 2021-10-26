import { array, string, voidType } from 'io-ts';
import { memoize, omit } from 'lodash';

import {
  ApiRequest,
  FetchApiOptions,
  FetchClientWithCredentials,
  createJsonRequest,
  ioTransformer,
} from '@veupathdb/http-utils';

import { User } from '@veupathdb/wdk-client/lib/Utils/WdkUser';

import { makeReportPollingPromise } from '../components/BlastWorkspaceResult';

import {
  ApiResult,
  ErrorDetails,
  IoBlastConfig,
  IoBlastFormat,
  ReportConfig,
  createJobResponse,
  createReportResponse,
  errorDetails,
  longJobResponse,
  longReportResponse,
  multiQueryReportJson,
  shortJobResponse,
  shortReportResponse,
} from './ServiceTypes';
import { BlastCompatibleWdkService } from './wdkServiceIntegration';
import { isLeft } from 'fp-ts/lib/Either';

const JOBS_PATH = '/jobs';
const REPORTS_PATH = '/reports';

export class BlastApi extends FetchClientWithCredentials {
  public static getBlastClient = memoize(
    (
      baseUrl: string,
      wdkService: BlastCompatibleWdkService,
      reportError: (error: any) => void
    ) => {
      return new BlastApi({ baseUrl }, wdkService, reportError);
    }
  );

  constructor(
    options: FetchApiOptions,
    protected readonly wdkService: BlastCompatibleWdkService,
    protected reportError: (error: any) => void
  ) {
    super(options, wdkService);
  }

  async taggedFetch<T>(
    apiRequest: ApiRequest<T>
  ): Promise<ApiResult<T, ErrorDetails>> {
    try {
      return {
        status: 'ok',
        value: await super.fetch(apiRequest),
      };
    } catch (error: any) {
      if (
        typeof error === 'object' &&
        error != null &&
        typeof error.message === 'string'
      ) {
        const decodedErrorDetails = errorDetails.decode(
          error.message.replace(/^[^{]*(\{.*\})[^}]*$/, '$1')
        );

        if (isLeft(decodedErrorDetails)) {
          return {
            status: 'error',
            details: {
              status: 'unknown',
              message: error.message,
            },
          };
        }

        if (decodedErrorDetails.right.status !== 'invalid-input') {
          this.reportError(error);
        }

        return {
          status: 'error',
          details: decodedErrorDetails.right,
        };
      } else {
        throw error;
      }
    }
  }

  fetchJobEntities() {
    return this.taggedFetch({
      path: JOBS_PATH,
      method: 'GET',
      transformResponse: ioTransformer(array(shortJobResponse)),
    });
  }

  createJob(
    site: string,
    targets: { organism: string; target: string }[],
    query: string | File,
    config: IoBlastConfig,
    maxResultSize: number = 0,
    description?: string
  ) {
    const requestProperties = {
      site,
      targets,
      config:
        query instanceof File
          ? omit(config, 'query')
          : {
              ...config,
              query,
            },
      maxResultSize,
      description,
    };

    if (query instanceof File) {
      const requestBody = new FormData();

      requestBody.append('properties', JSON.stringify(requestProperties));

      requestBody.append('query', query);

      return this.taggedFetch({
        path: JOBS_PATH,
        method: 'POST',
        body: requestBody,
        transformResponse: ioTransformer(createJobResponse),
      });
    } else {
      return this.taggedFetch(
        createJsonRequest({
          path: JOBS_PATH,
          method: 'POST',
          body: requestProperties,
          transformResponse: ioTransformer(createJobResponse),
        })
      );
    }
  }

  fetchJob(jobId: string) {
    return this.taggedFetch({
      path: `${JOBS_PATH}/${jobId}`,
      method: 'GET',
      transformResponse: ioTransformer(longJobResponse),
    });
  }

  rerunJob(jobId: string) {
    return this.taggedFetch({
      path: `${JOBS_PATH}/${jobId}`,
      method: 'POST',
      transformResponse: ioTransformer(voidType),
    });
  }

  fetchReportEntities() {
    return this.taggedFetch({
      path: REPORTS_PATH,
      method: 'GET',
      transformResponse: ioTransformer(array(shortReportResponse)),
    });
  }

  createReport(jobId: string, reportConfig: ReportConfig) {
    return this.taggedFetch(
      createJsonRequest({
        path: REPORTS_PATH,
        method: 'POST',
        body: {
          jobID: jobId,
          ...reportConfig,
        },
        transformResponse: ioTransformer(createReportResponse),
      })
    );
  }

  fetchReport(reportId: string) {
    return this.taggedFetch({
      path: `${REPORTS_PATH}/${reportId}`,
      method: 'GET',
      transformResponse: ioTransformer(longReportResponse),
    });
  }

  rerunReport(reportId: string) {
    return this.taggedFetch({
      path: `${REPORTS_PATH}/${reportId}`,
      method: 'POST',
      transformResponse: ioTransformer(voidType),
    });
  }

  fetchSingleFileJsonReport(reportId: string) {
    return this.taggedFetch({
      path: `${REPORTS_PATH}/${reportId}/files/report.json?download=false`,
      method: 'GET',
      transformResponse: ioTransformer(multiQueryReportJson),
    });
  }

  fetchQuery(jobId: string) {
    return this.taggedFetch({
      path: `${JOBS_PATH}/${jobId}/query?download=false`,
      method: 'GET',
      transformResponse: ioTransformer(string),
    });
  }
}

// FIXME: Update createRequestHandler to accommodate responses
// with "attachment" Content-Disposition
export function createJobContentDownloader(
  user: User,
  blastApi: BlastApi,
  blastServiceUrl: string,
  jobId: string
) {
  return async function downloadJobContent(
    format: IoBlastFormat,
    shouldZip: boolean,
    filename: string
  ) {
    const reportResponse = await makeReportPollingPromise(
      blastApi,
      jobId,
      format
    );

    if (reportResponse.status === 'queueing-error') {
      throw new Error('We were unable to queue your report.');
    }

    if (reportResponse.status === 'request-error') {
      throw new Error(
        `An error occurred while trying to create your report: ${JSON.stringify(
          reportResponse.details
        )}`
      );
    }

    const { reportID, files = [] } = reportResponse.report;

    const nonZippedReportFiles = files.filter(
      (file) => file !== 'meta.json' && !file.endsWith('.zip')
    );

    const reportFile =
      shouldZip || nonZippedReportFiles[0] == null
        ? 'report.zip'
        : nonZippedReportFiles[0];

    const downloadResponse = await fetch(
      `${blastServiceUrl}/reports/${reportID}/files/${reportFile}`,
      {
        headers: { 'Auth-Key': getAuthKey(user) },
      }
    );

    if (!downloadResponse.ok) {
      throw new Error(
        'An error occurred while trying to download your report.'
      );
    }

    const blob = await downloadResponse.blob();

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

function getAuthKey(user: User) {
  if (user.isGuest) {
    return `${user.id}`;
  }

  const wdkCheckAuth =
    document.cookie.split('; ').find((x) => x.startsWith('wdk_check_auth=')) ??
    '';
  const authKey = wdkCheckAuth.replace('wdk_check_auth=', '');

  return authKey;
}
