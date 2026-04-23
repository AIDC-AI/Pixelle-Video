import type { components } from '@/types/api';

type WorkflowInfo = components['schemas']['WorkflowInfo'];

export const RUNNINGHUB_INSTANCE_TYPE_AUTO = 'auto';
export const RUNNINGHUB_INSTANCE_TYPE_PLUS = 'plus';

export type RunningHubInstanceTypeValue =
  | typeof RUNNINGHUB_INSTANCE_TYPE_AUTO
  | typeof RUNNINGHUB_INSTANCE_TYPE_PLUS;

export function normalizeRunningHubInstanceType(
  value: string | null | undefined
): RunningHubInstanceTypeValue {
  return value === RUNNINGHUB_INSTANCE_TYPE_PLUS
    ? RUNNINGHUB_INSTANCE_TYPE_PLUS
    : RUNNINGHUB_INSTANCE_TYPE_AUTO;
}

export function toRunningHubInstanceTypePayload(
  value: string | null | undefined
): RunningHubInstanceTypeValue {
  return normalizeRunningHubInstanceType(value);
}

export function findWorkflowSource(
  workflows: WorkflowInfo[] | undefined,
  workflowKey: string | null | undefined
): WorkflowInfo['source'] | null {
  if (!workflowKey) {
    return null;
  }

  return workflows?.find((workflow) => workflow.key === workflowKey)?.source ?? null;
}

export function isRunningHubWorkflow(
  workflows: WorkflowInfo[] | undefined,
  workflowKey: string | null | undefined
): boolean {
  return findWorkflowSource(workflows, workflowKey) === 'runninghub';
}
