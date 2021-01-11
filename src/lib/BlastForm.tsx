import { useMemo } from 'react';

import { IconAlt } from '@veupathdb/wdk-client/lib/Components';
import { isEnumParam } from '@veupathdb/wdk-client/lib/Views/Question/Params/EnumParamUtils';
import { QuestionWithMappedParameters } from '@veupathdb/wdk-client/lib/StoreModules/QuestionStoreModule';
import { makeClassNameHelper } from '@veupathdb/wdk-client/lib/Utils/ComponentUtils';
import { Parameter, ParameterGroup } from '@veupathdb/wdk-client/lib/Utils/WdkModel';
import DefaultQuestionForm, { ParameterList, Props,  renderDefaultParamGroup } from '@veupathdb/wdk-client/lib/Views/Question/DefaultQuestionForm';

import { changeGroupVisibility, updateParamValue } from '@veupathdb/wdk-client/lib/Actions/QuestionActions';

const ADVANCED_PARAMS_GROUP_NAME = 'advancedParams';

const BLAST_ALGORITHM_PARAM_NAME = 'BlastAlgorithm';

const OMIT_PARAM_TERM = 'none';

const cx = makeClassNameHelper('wdk-QuestionForm');

export function BlastForm(props: Props) {
  const selectedBlastAlgorithm = props.state.paramValues[BLAST_ALGORITHM_PARAM_NAME];

  const paramsWhichDependOnlyOnBlastAlgorithm = useMemo(
    () => findParamsWhichDependOnlyOnBlastAlgorithm(props.state.question),
    [ props.state.question ]
  );

  const advancedParamGroupChanging = useMemo(
    () => paramsWhichDependOnlyOnBlastAlgorithm.some(
      paramName => props.state.paramDependenciesUpdating[paramName]
    ),
    [ selectedBlastAlgorithm, props.state.paramDependenciesUpdating ]
  );

  const renderBlastParamGroup = useMemo(() => {
    const fullAdvancedParamGroup = props.state.question.groupsByName[ADVANCED_PARAMS_GROUP_NAME];

    const restrictedAdvancedParamGroup = {
      ...fullAdvancedParamGroup,
      parameters: fullAdvancedParamGroup.parameters.filter(
        paramName => !isOmittedParam(props.state.question.parametersByName[paramName])
      )
    };

    return (group: ParameterGroup, formProps: Props) =>
      group.name !== ADVANCED_PARAMS_GROUP_NAME
        ? renderDefaultParamGroup(group, formProps)
        : (
          <ShowHideGroup
            disabled={advancedParamGroupChanging}
            key={group.name}
            searchName={formProps.state.question.urlSegment}
            group={restrictedAdvancedParamGroup}
            uiState={
              !advancedParamGroupChanging
                ? formProps.state.groupUIState[group.name]
                : ({
                    ...formProps.state.groupUIState[group.name],
                    isVisible: false
                  })
            }
            onVisibilityChange={formProps.eventHandlers.setGroupVisibility}
          >
            <ParameterList
              parameters={restrictedAdvancedParamGroup.parameters}
              parameterMap={formProps.state.question.parametersByName}
              parameterElements={formProps.parameterElements}
              paramDependenciesUpdating={formProps.state.paramDependenciesUpdating}
            />
          </ShowHideGroup>
        );
  }, [ advancedParamGroupChanging, selectedBlastAlgorithm ]);

  return (
    <DefaultQuestionForm
      {...props}
      renderParamGroup={renderBlastParamGroup}
    />
  );
}

function isOmittedParam(param?: Parameter) {
  return param == null || !isEnumParam(param) || param.displayType === 'treeBox'
    ? false
    : (
      param.vocabulary.length === 1 &&
      param.vocabulary[0][0] === OMIT_PARAM_TERM
    );
}

function computeParamDependencies(question: QuestionWithMappedParameters) {
  return question.parameters.reduce(
    (memo, param) => {
      param.dependentParams.forEach(depedendentParam => {
        if (!memo.has(depedendentParam)) {
          memo.set(depedendentParam, new Set());
        }

        memo.get(depedendentParam)?.add(param.name);
      });

      return memo;
    },
    new Map<string, Set<string>>()
  );
}

function findParamsWhichDependOnlyOnBlastAlgorithm(question: QuestionWithMappedParameters) {
  const paramDependencies = computeParamDependencies(question);

  const values = [ ...paramDependencies.entries() ] ;

  return values
    .filter(
      ([ , dependencies ]) => (
        dependencies.size === 1 &&
        dependencies.has(BLAST_ALGORITHM_PARAM_NAME)
      )
    )
    .map(
      ([ paramName ]) => paramName
    );
}

type EventHandlers = {
  setGroupVisibility: typeof changeGroupVisibility,
  updateParamValue: typeof updateParamValue
}

type GroupProps = {
  searchName: string;
  group: ParameterGroup;
  uiState: any;
  onVisibilityChange: EventHandlers['setGroupVisibility'];
  children: React.ReactChild;
  disabled?: boolean;
}

function ShowHideGroup(props: GroupProps) {
  const { searchName, group, uiState: { isVisible }, onVisibilityChange, disabled = false } = props;
  return (
    <div className={cx('ShowHideGroup')} >
      <button
        disabled={disabled}
        type="button"
        className={cx('ShowHideGroupToggle')}
        onClick={() => {
          onVisibilityChange({
            searchName,
            groupName: group.name,
            isVisible: !isVisible
          })
        }}
      >
        <IconAlt fa={`caret-${isVisible ? 'down' : 'right'}`}/> {group.displayName}
      </button>
      <div className={cx('ShowHideGroupContent')} >
        {isVisible ? props.children : null}
      </div>
    </div>
  )
}
