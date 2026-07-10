'use client';

import * as RadixSwitch from '@radix-ui/react-switch';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}

export function Switch(props: SwitchProps) {
  return (
    <RadixSwitch.Root className="mq-switch" {...props}>
      <RadixSwitch.Thumb className="mq-switch__thumb" />
    </RadixSwitch.Root>
  );
}
