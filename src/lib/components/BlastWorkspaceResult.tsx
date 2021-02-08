import { useMemo } from 'react';

import { uniq } from 'lodash';

import { Link, Loading } from '@veupathdb/wdk-client/lib/Components';
import { usePromise } from '@veupathdb/wdk-client/lib/Hooks/PromiseHook';
import { useWdkService } from '@veupathdb/wdk-client/lib/Hooks/WdkServiceHook';

import { useBlastApi, useDownloadJobQueryCallback } from '../hooks/api';
import {
  useHitTypeDisplayName,
  useWdkRecordType,
} from '../hooks/combinedResults';
import { LongJobResponse, MultiQueryReportJson } from '../utils/ServiceTypes';
import { dbToTargetName } from '../utils/combinedResults';
import { fetchOrganismToFilenameMaps } from '../utils/organisms';

import { blastWorkspaceCx } from './BlastWorkspace';
import { CombinedBlastResult } from './CombinedBlastResult';

import './BlastWorkspaceResult.scss';

interface Props {
  jobId: string;
}

const POLLING_INTERVAL = 3000;

export function BlastWorkspaceResult(props: Props) {
  const api = useBlastApi();

  const organismToFilenameMapsResult = useWdkService(
    (wdkService) => fetchOrganismToFilenameMaps(wdkService),
    []
  );

  const jobResult = usePromise(() => makeJobPollingPromise(api, props.jobId), [
    api,
    props.jobId,
  ]);

  const multiQueryReportResult = usePromise(
    async () =>
      jobResult.value?.status !== 'completed'
        ? undefined
        : api.fetchSingleFileJsonReport(jobResult.value.id),
    [api, jobResult.value?.status]
  );

  return organismToFilenameMapsResult == null ||
    jobResult.value == null ||
    multiQueryReportResult.value == null ? (
    <LoadingBlastResult {...props} />
  ) : (
    <BlastSummary
      filesToOrganisms={organismToFilenameMapsResult.filesToOrganisms}
      jobDetails={jobResult.value}
      multiQueryReport={multiQueryReportResult.value}
    />
  );
}

function LoadingBlastResult(props: Props) {
  return (
    <div className={blastWorkspaceCx('Result', 'Loading')}>
      <h1>BLAST Job - pending</h1>
      <p className="JobId">
        <span className="InlineHeader">Job:</span> {props.jobId}
      </p>
      <Loading>
        <div className="Caption">
          <p className="Status">
            <span className="InlineHeader">Status:</span> running
          </p>
          <p className="Instructions">
            This job could take some time to run. You may leave this page and
            access the result from your{' '}
            <Link to="/workspace/blast/all">jobs list</Link> later, or{' '}
            <Link to="/workspace/blast/new">submit another BLAST job</Link>{' '}
            while you wait.
          </p>
        </div>
      </Loading>
    </div>
  );
}

interface BlastSummaryProps {
  filesToOrganisms: Record<string, string>;
  jobDetails: LongJobResponse;
  multiQueryReport: MultiQueryReportJson;
}

function BlastSummary({
  filesToOrganisms,
  jobDetails,
  multiQueryReport,
}: BlastSummaryProps) {
  const databases = useMemo(() => {
    const databasesEntries = multiQueryReport.BlastOutput2.map(({ report }) =>
      dbToTargetName(report.search_target.db)
    );

    return uniq(databasesEntries);
  }, [multiQueryReport]);

  const databasesStr = useMemo(() => databases.join(', '), [databases]);

  const downloadJobQuery = useDownloadJobQueryCallback(jobDetails.id);

  const wdkRecordType = useWdkRecordType(multiQueryReport);

  const hitTypeDisplayName = useHitTypeDisplayName(wdkRecordType);

  return (
    <div className={blastWorkspaceCx('Result', 'Complete')}>
      <h1>BLAST Job - result</h1>
      <Link className="BackToAllJobs" to="/workspace/blast/all">
        &lt;&lt; All my BLAST Jobs
      </Link>
      <div className="ConfigDetails">
        <span className="InlineHeader">Job:</span>
        <span>{jobDetails.id}</span>
        <span className="InlineHeader">Program:</span>
        <span>
          {jobDetails.config.tool === 'tblastx' ||
          jobDetails.config.task == null
            ? jobDetails.config.tool
            : jobDetails.config.task}
        </span>
        <span className="InlineHeader">Target Type:</span>
        <span>{hitTypeDisplayName}</span>
        <span className="InlineHeader">
          {databases.length > 1 ? 'Databases' : 'Database'}:
        </span>
        <span>{databasesStr}</span>
        <span className="InlineHeader">Query:</span>
        <Link to="#" onClick={downloadJobQuery}>
          Download Query File
        </Link>
      </div>
      <CombinedBlastResult
        combinedResult={multiQueryReport}
        filesToOrganisms={filesToOrganisms}
        hitTypeDisplayName={hitTypeDisplayName}
        wdkRecordType={wdkRecordType}
      />
    </div>
  );
}

async function makeJobPollingPromise(
  api: ReturnType<typeof useBlastApi>,
  jobId: string
): Promise<LongJobResponse> {
  const job = await api.fetchJob(jobId);

  if (job.status === 'completed' || job.status === 'errored') {
    return job;
  }

  await waitForNextPoll();

  return makeJobPollingPromise(api, jobId);
}

function waitForNextPoll() {
  return new Promise(function (resolve, reject) {
    setTimeout(resolve, POLLING_INTERVAL);
  });
}
