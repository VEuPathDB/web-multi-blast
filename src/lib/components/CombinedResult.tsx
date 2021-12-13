import { Either, isLeft } from 'fp-ts/Either';

import Mesa from '@veupathdb/wdk-client/lib/Components/Mesa';
import { makeClassNameHelper } from '@veupathdb/wdk-client/lib/Utils/ComponentUtils';

import { ErrorDetails } from '../utils/ServiceTypes';

import { BlastRequestError } from './BlastRequestError';
import { ReportSelect } from './ReportSelect';

import './CombinedResult.scss';

const cx = makeClassNameHelper('CombinedResult');

// FIXME: Get rid of this "any" once we have type declarations for Mesa
export type TableState = any;

export interface Props {
  downloadTableOptions:
    | { offer: false }
    | { offer: true; onClickDownloadTable: () => void };
  hitQueryCount?: number;
  hitSubjectCount?: number;
  hitTypeDisplayName: string;
  hitTypeDisplayNamePlural: string;
  jobId: string;
  tableState: Either<ErrorDetails, TableState>;
  totalQueryCount?: number;
}

export function CombinedResult({
  downloadTableOptions,
  hitQueryCount,
  hitSubjectCount,
  hitTypeDisplayName,
  hitTypeDisplayNamePlural,
  jobId,
  tableState,
  totalQueryCount,
}: Props) {
  return isLeft(tableState) ? (
    <BlastRequestError errorDetails={tableState.left} />
  ) : (
    <div className={cx()}>
      <Mesa state={tableState.right}>
        {hitQueryCount != null &&
          hitSubjectCount != null &&
          totalQueryCount != null && (
            <div className="ResultSummary">
              {hitQueryCount} of your {totalQueryCount} query sequences hit{' '}
              {hitSubjectCount}{' '}
              {hitSubjectCount === 1
                ? hitTypeDisplayName
                : hitTypeDisplayNamePlural}
            </div>
          )}
        <div className={cx('--DownloadOptions')}>
          <ReportSelect jobId={jobId} placeholder="Download all results" />
          {downloadTableOptions.offer && (
            <button
              type="button"
              onClick={downloadTableOptions.onClickDownloadTable}
            >
              Download this table
            </button>
          )}
        </div>
      </Mesa>
    </div>
  );
}
