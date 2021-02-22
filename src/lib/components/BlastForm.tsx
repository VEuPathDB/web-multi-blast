import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useHistory } from 'react-router';

import { fromPairs } from 'lodash';

import { RadioList, TextArea } from '@veupathdb/wdk-client/lib/Components';
import { WdkDepdendenciesContext } from '@veupathdb/wdk-client/lib/Hooks/WdkDependenciesEffect';
import { makeClassNameHelper } from '@veupathdb/wdk-client/lib/Utils/ComponentUtils';
import { ParameterGroup } from '@veupathdb/wdk-client/lib/Utils/WdkModel';
import DefaultQuestionForm, {
  ParameterList,
  Props as DefaultQuestionFormProps,
  SubmitButton,
  renderDefaultParamGroup,
} from '@veupathdb/wdk-client/lib/Views/Question/DefaultQuestionForm';

import { useBlastApi } from '../hooks/api';
import { useEnabledAlgorithms } from '../hooks/blastAlgorithms';
import {
  useAlgorithmParamProps,
  useSequenceParamProps,
  useTargetParamProps,
} from '../hooks/params';
import {
  ADVANCED_PARAMS_GROUP_NAME,
  BLAST_ALGORITHM_PARAM_NAME,
  BLAST_DATABASE_ORGANISM_PARAM_NAME,
  BLAST_DATABASE_TYPE_PARAM_NAME,
  BLAST_QUERY_SEQUENCE_PARAM_NAME,
  JOB_DESCRIPTION_PARAM_NAME,
  isOmittedParam,
  organismParamValueToFilenames,
  paramValuesToBlastConfig,
} from '../utils/params';
import { fetchOrganismToFilenameMaps } from '../utils/organisms';

import { AdvancedParamGroup } from './AdvancedParamGroup';

import './BlastForm.scss';

export const blastFormCx = makeClassNameHelper('wdk-QuestionForm');

const BLAST_FORM_CONTAINER_NAME = 'MultiBlast';

export type Props = DefaultQuestionFormProps;

export function BlastForm(props: Props) {
  const targetType = props.state.paramValues[BLAST_DATABASE_TYPE_PARAM_NAME];

  const selectedBlastAlgorithm =
    props.state.paramValues[BLAST_ALGORITHM_PARAM_NAME];

  const advancedParamGroupChanging =
    props.state.paramsUpdatingDependencies[BLAST_ALGORITHM_PARAM_NAME];

  const restrictedAdvancedParamGroup = useMemo(() => {
    const fullAdvancedParamGroup =
      props.state.question.groupsByName[ADVANCED_PARAMS_GROUP_NAME];

    return {
      ...fullAdvancedParamGroup,
      displayName: `Advanced ${selectedBlastAlgorithm.toUpperCase()} Parameters`,
      parameters: fullAdvancedParamGroup.parameters.filter(
        (paramName) =>
          !isOmittedParam(props.state.question.parametersByName[paramName])
      ),
    };
  }, [
    selectedBlastAlgorithm,
    props.state.question.groupsByName,
    props.state.question.parametersByName,
  ]);

  const renderBlastParamGroup = useCallback(
    (group: ParameterGroup, formProps: Props) => (
      <div key={group.name} className={blastFormCx('Group', group.name)}>
        {group.name !== ADVANCED_PARAMS_GROUP_NAME ? (
          renderDefaultParamGroup(group, formProps)
        ) : (
          <AdvancedParamGroup
            disabled={advancedParamGroupChanging}
            key={group.name}
            searchName={formProps.state.question.urlSegment}
            group={restrictedAdvancedParamGroup}
            uiState={
              !advancedParamGroupChanging
                ? formProps.state.groupUIState[group.name]
                : {
                    ...formProps.state.groupUIState[group.name],
                    isVisible: false,
                  }
            }
            onVisibilityChange={formProps.eventHandlers.setGroupVisibility}
          >
            <ParameterList
              parameters={restrictedAdvancedParamGroup.parameters}
              parameterMap={formProps.state.question.parametersByName}
              parameterElements={formProps.parameterElements}
              paramDependenciesUpdating={fromPairs(
                formProps.state.question.parameters
                  .filter(
                    (parameter) =>
                      formProps.state.paramsUpdatingDependencies[parameter.name]
                  )
                  .flatMap((parameter) =>
                    parameter.dependentParams.map((pn) => [pn, true])
                  )
              )}
            />
          </AdvancedParamGroup>
        )}
      </div>
    ),
    [advancedParamGroupChanging, restrictedAdvancedParamGroup]
  );

  const enabledAlgorithms = useEnabledAlgorithms(targetType);

  const [queryFileProvided, setQueryFileProvided] = useState(false);

  const onQueryFileInputChanged = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      alert('Under Construction');

      setQueryFileProvided(
        event.target.files != null && event.target.files.length > 0
      );
    },
    [setQueryFileProvided]
  );

  const targetParamProps = useTargetParamProps(
    props.state,
    props.eventHandlers.updateParamValue
  );
  const algorithmParamProps = useAlgorithmParamProps(
    props.state,
    props.eventHandlers.updateParamValue,
    enabledAlgorithms
  );
  const sequenceParamProps = useSequenceParamProps(
    props.state,
    props.eventHandlers.updateParamValue,
    queryFileProvided
  );

  const targetParamElement = (
    <RadioList
      {...targetParamProps}
      name={`${props.state.question.urlSegment}/${BLAST_DATABASE_TYPE_PARAM_NAME}`}
    />
  );
  const algorithmParamElement = (
    <RadioList
      {...algorithmParamProps}
      name={`${props.state.question.urlSegment}/${BLAST_ALGORITHM_PARAM_NAME}`}
    />
  );
  const sequenceParamElement = (
    <div className="SequenceParam">
      <div className="SequenceParamInstructions">
        Paste one or several sequences, or provide a FASTA file.
      </div>
      <TextArea
        {...sequenceParamProps}
        name={`${props.state.question.urlSegment}/${BLAST_QUERY_SEQUENCE_PARAM_NAME}`}
      />
      <input
        type="file"
        name={`${props.state.question.urlSegment}/${BLAST_QUERY_SEQUENCE_PARAM_NAME}__file`}
        onChange={onQueryFileInputChanged}
      />
    </div>
  );

  const parameterElements = {
    ...props.parameterElements,
    [BLAST_DATABASE_TYPE_PARAM_NAME]: targetParamElement,
    [BLAST_ALGORITHM_PARAM_NAME]: algorithmParamElement,
    [BLAST_QUERY_SEQUENCE_PARAM_NAME]: sequenceParamElement,
  };

  const containerClassName = `${blastFormCx()} ${blastFormCx(
    BLAST_FORM_CONTAINER_NAME
  )}`;

  return enabledAlgorithms == null ? null : props.submissionMetadata.type ===
    'create-strategy' ? (
    <NewJobForm
      {...props}
      containerClassName={containerClassName}
      renderParamGroup={renderBlastParamGroup}
      parameterElements={parameterElements}
    />
  ) : (
    <DefaultQuestionForm
      {...props}
      containerClassName={containerClassName}
      renderParamGroup={renderBlastParamGroup}
      parameterElements={parameterElements}
    />
  );
}

interface NewJobFormProps extends Props {
  renderParamGroup: (group: ParameterGroup, formProps: Props) => JSX.Element;
}

function NewJobForm(props: NewJobFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const api = useBlastApi();

  const wdkDependencies = useContext(WdkDepdendenciesContext);

  const history = useHistory();

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      if (wdkDependencies == null) {
        throw new Error(
          'To use this form, WdkDependendenciesContext must be configured.'
        );
      }

      e.preventDefault();

      setSubmitting(true);

      const [projectId, { organismsToFiles }] = await Promise.all([
        wdkDependencies.wdkService
          .getConfig()
          .then(({ projectId }) => projectId),
        fetchOrganismToFilenameMaps(wdkDependencies.wdkService),
      ]);

      const selectedOrganismFilenames = organismParamValueToFilenames(
        props.state.paramValues[BLAST_DATABASE_ORGANISM_PARAM_NAME],
        organismsToFiles
      );

      const targetType =
        props.state.paramValues[BLAST_DATABASE_TYPE_PARAM_NAME];

      const targets = selectedOrganismFilenames.map((organism) => ({
        organism,
        target: `${organism}${targetType}`,
      }));

      const { jobId } = await api.createJob(
        projectId,
        targets,
        paramValuesToBlastConfig(props.state.paramValues),
        props.state.paramValues[JOB_DESCRIPTION_PARAM_NAME]
      );

      setSubmitting(false);

      history.push(`/workspace/blast/result/${jobId}`);
    },
    [api, history, wdkDependencies, props.state.paramValues]
  );

  return (
    <div className={props.containerClassName}>
      <form onSubmit={onSubmit}>
        {props.state.question.groups
          .filter((group) => group.displayType !== 'hidden')
          .map((group) => props.renderParamGroup(group, props))}
        <div className={blastFormCx('SubmitSection')}>
          <SubmitButton
            submissionMetadata={props.submissionMetadata}
            submitting={submitting}
            submitButtonText={props.submitButtonText}
          />
        </div>
      </form>
    </div>
  );
}
