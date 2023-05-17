/*
 *  Copyright 2023 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { getCustomLogoConfig } from 'rest/settingConfigAPI';
import ApplicationConfigProvider, {
  useApplicationConfigProvider,
} from './ApplicationConfigProvider';

const mockApplicationConfig = {
  customLogoUrlPath: 'https://customlink.source',
  customMonogramUrlPath: 'https://customlink.source',
};

jest.mock('rest/settingConfigAPI', () => ({
  getCustomLogoConfig: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockApplicationConfig)),
}));

describe('ApplicationConfigProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the children components', async () => {
    await act(async () => {
      render(
        <ApplicationConfigProvider>
          <div>Test Children</div>
        </ApplicationConfigProvider>
      );
    });

    expect(screen.getByText('Test Children')).toBeInTheDocument();
  });

  it('fetch the application config on mount and set in the context', async () => {
    function TestComponent() {
      const { customLogoUrlPath } = useApplicationConfigProvider();

      return <div>{customLogoUrlPath}</div>;
    }

    await act(async () => {
      render(
        <ApplicationConfigProvider>
          <TestComponent />
        </ApplicationConfigProvider>
      );
    });

    expect(
      await screen.findByText('https://customlink.source')
    ).toBeInTheDocument();

    expect(getCustomLogoConfig).toHaveBeenCalledTimes(1);
  });
});
