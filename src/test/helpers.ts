import { act, fireEvent, render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import {
  installDesktopApiMock,
  type DesktopApiMockController,
} from './mockDesktopApi';
import type { DesktopSeed } from './factories';

interface RenderWithDesktopApiOptions {
  seed?: Partial<DesktopSeed>;
  renderOptions?: Omit<RenderOptions, 'wrapper'>;
}

export function renderWithDesktopApi(
  ui: ReactElement,
  options: RenderWithDesktopApiOptions = {}
) {
  const desktop = installDesktopApiMock(options.seed);
  const user = userEvent.setup();

  return {
    user,
    desktop,
    ...render(ui, options.renderOptions),
  };
}

export function createUser() {
  return userEvent.setup();
}

export function mockConfirm(result = true) {
  return vi.spyOn(window, 'confirm').mockImplementation(() => result);
}

export function pressWindowShortcut(
  key: string,
  options: Partial<KeyboardEventInit> = {}
) {
  fireEvent.keyDown(window, {
    key,
    ctrlKey: true,
    ...options,
  });
}

export async function advanceDebounce(duration = 800) {
  await act(async () => {
    vi.advanceTimersByTime(duration);
  });
}

export function setDesktopApi(controller: DesktopApiMockController) {
  window.desktopApi = controller.api;
}
