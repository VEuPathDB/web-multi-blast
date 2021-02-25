import { useMemo } from 'react';

import { Link } from '@veupathdb/wdk-client/lib/Components';
import { MesaColumn } from '@veupathdb/wdk-client/lib/Core/CommonTypes';
import { usePromise } from '@veupathdb/wdk-client/lib/Hooks/PromiseHook';

import { JobRow } from '../components/BlastWorkspaceAll';
import {
  entityStatusToReadableStatus,
  shouldIncludeInJobsTable,
} from '../utils/allJobs';
import { BlastApi } from '../utils/api';

export function useAllJobsColumns(): MesaColumn<keyof JobRow>[] {
  return useMemo(
    () => [
      {
        key: 'jobId',
        name: 'Job Id',
        renderCell: ({ row }: { row: JobRow }) => (
          <Link to={`/workspace/blast/result/${row.jobId}`}>{row.jobId}</Link>
        ),
      },
      {
        key: 'description',
        name: 'Description',
        renderCell: ({ row }: { row: JobRow }) => row.description ?? 'Untitled',
      },
      {
        key: 'created',
        name: 'Submission Date',
      },
      {
        key: 'status',
        name: 'Status',
      },
      {
        key: 'expires',
        name: 'Expiration Date',
      },
    ],
    []
  );
}

export function useRawJobRows(blastApi: BlastApi): JobRow[] | undefined {
  const result = usePromise(async () => {
    const jobEntities = await blastApi.fetchJobEntities();

    return jobEntities?.filter(shouldIncludeInJobsTable).map((jobEntity) => ({
      jobId: jobEntity.id,
      description: jobEntity.description ?? null,
      created: new Date(jobEntity.created).toLocaleDateString(),
      expires: new Date(jobEntity.expires).toLocaleDateString(),
      status: entityStatusToReadableStatus(jobEntity.status),
    }));
  }, []);

  return result.value;
}