import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from './command';

describe('Command UI', () => {
  it('renders the command primitives with selectable items', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <Command>
        <CommandInput placeholder="Search commands" />
        <CommandList>
          <CommandEmpty>No command found.</CommandEmpty>
          <CommandGroup heading="Pages">
            <CommandItem value="create" onSelect={onSelect}>
              Create
              <CommandShortcut>⌘K</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    );

    expect(screen.getByPlaceholderText('Search commands')).toBeInTheDocument();
    await user.click(screen.getByText('Create'));

    expect(onSelect).toHaveBeenCalledWith('create');
  });

  it('renders command dialog content when open', () => {
    render(
      <CommandDialog open onOpenChange={vi.fn()} label="Command menu">
        <CommandInput placeholder="Search commands" />
        <CommandList>
          <CommandItem value="settings">Settings</CommandItem>
        </CommandList>
      </CommandDialog>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
