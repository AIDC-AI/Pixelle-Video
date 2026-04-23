'use client';

import { FieldLabel } from '@/components/create/field-label';
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useAppTranslations } from '@/lib/i18n';
import {
  RUNNINGHUB_INSTANCE_TYPE_AUTO,
  RUNNINGHUB_INSTANCE_TYPE_PLUS,
  type RunningHubInstanceTypeValue,
} from '@/lib/runninghub-instance-type';

interface RunningHubInstanceTypeFieldProps {
  disabled?: boolean;
  testId?: string;
  value: RunningHubInstanceTypeValue;
  onChange: (value: RunningHubInstanceTypeValue) => void;
}

export function RunningHubInstanceTypeField({
  disabled = false,
  testId,
  value,
  onChange,
}: RunningHubInstanceTypeFieldProps) {
  const t = useAppTranslations('createCommon');
  const selectedLabel =
    value === RUNNINGHUB_INSTANCE_TYPE_PLUS
      ? t('runninghub.options.plus')
      : t('runninghub.options.auto');

  return (
    <FormItem>
      <FormLabel>
        <FieldLabel label={t('runninghub.instanceType')} />
      </FormLabel>
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as RunningHubInstanceTypeValue)}
        disabled={disabled}
      >
        <FormControl>
          <SelectTrigger aria-label={t('runninghub.instanceType')} data-testid={testId}>
            <span className="flex flex-1 text-left">{selectedLabel}</span>
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value={RUNNINGHUB_INSTANCE_TYPE_AUTO}>{t('runninghub.options.auto')}</SelectItem>
          <SelectItem value={RUNNINGHUB_INSTANCE_TYPE_PLUS}>{t('runninghub.options.plus')}</SelectItem>
        </SelectContent>
      </Select>
      <FormDescription>{t('runninghub.description')}</FormDescription>
      <FormMessage />
    </FormItem>
  );
}
