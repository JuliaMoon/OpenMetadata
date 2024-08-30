/*
 *  Copyright 2024 Collate.
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
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { triggerTestCasePipeline } from '../../common/Utils/DataQuality';
import {
  createEntityTableViaREST,
  deleteEntityViaREST,
  visitEntityDetailsPage,
} from '../../common/Utils/Entity';
import { getToken } from '../../common/Utils/LocalStorage';
import { generateRandomUser } from '../../common/Utils/Owner';
import { uuid } from '../../constants/constants';
import { EntityType, SidebarItem } from '../../constants/Entity.interface';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
const TABLE_NAME = DATABASE_SERVICE.entity.name;

const testSuite = {
  name: `${DATABASE_SERVICE.entity.databaseSchema}.${DATABASE_SERVICE.entity.name}.testSuite`,
  executableEntityReference: `${DATABASE_SERVICE.entity.databaseSchema}.${DATABASE_SERVICE.entity.name}`,
};

const testCases = [
  `cy_first_table_column_count_to_be_between_${uuid()}`,
  `cy_second_table_column_count_to_be_between_${uuid()}`,
  `cy_third_table_column_count_to_be_between_${uuid()}`,
];
const user1 = generateRandomUser();
const user2 = generateRandomUser();
const user3 = generateRandomUser();
const userData1 = {
  displayName: `${user1.firstName}${user1.lastName}`,
  name: user1.email.split('@')[0],
};
const userData2 = {
  displayName: `${user2.firstName}${user2.lastName}`,
  name: user2.email.split('@')[0],
};
const userData3 = {
  displayName: `${user2.firstName}${user2.lastName}`,
  name: user2.email.split('@')[0],
};
const userIds: string[] = [];

const goToProfilerTab = () => {
  interceptURL(
    'GET',
    `api/v1/tables/name/${DATABASE_SERVICE.service.name}.*.${TABLE_NAME}?fields=*&include=all`,
    'waitForPageLoad'
  );
  visitEntityDetailsPage({
    term: TABLE_NAME,
    serviceName: DATABASE_SERVICE.service.name,
    entity: EntityType.Table,
  });
  verifyResponseStatusCode('@waitForPageLoad', 200);

  cy.get('[data-testid="profiler"]').should('be.visible').click();
  cy.get('[data-testid="profiler-tab-left-panel"]')
    .contains('Table Profile')
    .click();
};

const acknowledgeTask = (testCase: string) => {
  goToProfilerTab();

  cy.get('[data-testid="profiler-tab-left-panel"]')
    .contains('Data Quality')
    .click();
  cy.get(`[data-testid="${testCase}"]`)
    .find('.last-run-box.failed')
    .scrollIntoView()
    .should('be.visible');
  cy.get(`[data-testid="${testCase}-status"]`).should('contain', 'New');
  cy.get(`[data-testid="${testCase}"]`).contains(testCase).click();
  cy.get('[data-testid="edit-resolution-icon"]').click();
  cy.get('[data-testid="test-case-resolution-status-type"]').click();
  cy.get('[title="Ack"]').click();
  interceptURL(
    'POST',
    '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
    'updateTestCaseIncidentStatus'
  );
  cy.get('#update-status-button').click();
  verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
  cy.get(`[data-testid="${testCase}-status"]`).should('contain', 'Ack');
};

const assignIncident = (testCaseName: string) => {
  cy.sidebarClick(SidebarItem.INCIDENT_MANAGER);
  cy.get(`[data-testid="test-case-${testCaseName}"]`).should('be.visible');
  cy.get(`[data-testid="${testCaseName}-status"]`)
    .find(`[data-testid="edit-resolution-icon"]`)
    .click();
  cy.get(`[data-testid="test-case-resolution-status-type"]`).click();
  cy.get(`[title="Assigned"]`).click();
  cy.get('#testCaseResolutionStatusDetails_assignee').should('be.visible');
  interceptURL(
    'GET',
    `/api/v1/search/suggest?q=*${user1.firstName}*${user1.lastName}*&index=user_search_index*`,
    'searchAssignee'
  );
  interceptURL('GET', '/api/v1/users/name/*', 'userList');
  cy.get('#testCaseResolutionStatusDetails_assignee').click();
  cy.wait('@userList');
  cy.get('#testCaseResolutionStatusDetails_assignee').type(
    userData1.displayName
  );
  verifyResponseStatusCode('@searchAssignee', 200);
  cy.get(`[data-testid="${userData1.name.toLocaleLowerCase()}"]`).click();
  interceptURL(
    'POST',
    '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
    'updateTestCaseIncidentStatus'
  );
  cy.get('#update-status-button').click();
  verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
  cy.get(
    `[data-testid="${testCaseName}-status"] [data-testid="badge-container"]`
  ).should('contain', 'Assigned');
};

describe('Incident Manager', { tags: 'Observability' }, () => {
  before(() => {
    cy.login();

    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      // Create a new user
      for (const user of [user1, user2, user3]) {
        cy.request({
          method: 'POST',
          url: `/api/v1/users/signup`,
          headers: { Authorization: `Bearer ${token}` },
          body: user,
        }).then((response) => {
          userIds.push(response.body.id);
        });
      }

      createEntityTableViaREST({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.entity],
      });
      // create testSuite
      cy.request({
        method: 'POST',
        url: `/api/v1/dataQuality/testSuites/executable`,
        headers: { Authorization: `Bearer ${token}` },
        body: testSuite,
      }).then((testSuiteResponse) => {
        // creating test case

        testCases.forEach((testCase) => {
          cy.request({
            method: 'POST',
            url: `/api/v1/dataQuality/testCases`,
            headers: { Authorization: `Bearer ${token}` },
            body: {
              name: testCase,
              entityLink: `<#E::table::${testSuite.executableEntityReference}>`,
              parameterValues: [
                { name: 'minColValue', value: 12 },
                { name: 'maxColValue', value: 24 },
              ],
              testDefinition: 'tableColumnCountToBeBetween',
              testSuite: testSuite.name,
            },
          });
        });
        cy.request({
          method: 'POST',
          url: `/api/v1/services/ingestionPipelines`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            airflowConfig: {},
            name: `${testSuite.executableEntityReference}_test_suite`,
            pipelineType: 'TestSuite',
            service: {
              id: testSuiteResponse.body.id,
              type: 'testSuite',
            },
            sourceConfig: {
              config: {
                type: 'TestSuite',
                entityFullyQualifiedName: testSuite.executableEntityReference,
              },
            },
          },
        }).then((response) =>
          cy.request({
            method: 'POST',
            url: `/api/v1/services/ingestionPipelines/deploy/${response.body.id}`,
            headers: { Authorization: `Bearer ${token}` },
          })
        );
      });
    });

    triggerTestCasePipeline({
      serviceName: DATABASE_SERVICE.service.name,
      tableName: TABLE_NAME,
    });
  });

  after(() => {
    cy.login();

    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);
      deleteEntityViaREST({
        token,
        endPoint: EntityType.DatabaseService,
        entityName: DATABASE_SERVICE.service.name,
      });

      // Delete created user
      userIds.forEach((userId) => {
        cy.request({
          method: 'DELETE',
          url: `/api/v1/users/${userId}?hardDelete=true&recursive=false`,
          headers: { Authorization: `Bearer ${token}` },
        });
      });
    });
  });

  describe('Basic Scenario', () => {
    const testCaseName = testCases[0];

    beforeEach(() => {
      cy.login();
    });

    it("Acknowledge table test case's failure", () => {
      acknowledgeTask(testCaseName);
    });

    it('Assign incident to user', () => {
      assignIncident(testCaseName);
    });

    it('Re-assign incident to user', () => {
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/name/*?fields=*',
        'getTestCase'
      );
      interceptURL('GET', '/api/v1/feed?entityLink=*&type=Task', 'getTaskFeed');
      cy.sidebarClick(SidebarItem.INCIDENT_MANAGER);
      cy.get(`[data-testid="test-case-${testCaseName}"]`).click();
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('[data-testid="incident"]').click();
      verifyResponseStatusCode('@getTaskFeed', 200);
      cy.get('[data-testid="task-cta-buttons"] [role="img"]')
        .scrollIntoView()
        .click();
      cy.get('[role="menu"').find('[data-menu-id*="re-assign"]').click();

      interceptURL(
        'GET',
        `/api/v1/search/suggest?q=*${user2.firstName}*${user2.lastName}*&index=user_search_index*`,
        'searchAssignee'
      );
      interceptURL('GET', '/api/v1/users/name/*', 'userList');
      cy.get('[data-testid="select-assignee"]').click();
      cy.wait('@userList');
      cy.get('[data-testid="select-assignee"]').type(userData2.displayName);
      verifyResponseStatusCode('@searchAssignee', 200);
      cy.get(`[data-testid="${userData2.name.toLocaleLowerCase()}"]`).click();

      interceptURL(
        'POST',
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
        'updateTestCaseIncidentStatus'
      );
      cy.get('.ant-modal-footer').contains('Submit').click();
      verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
      // Todo: skipping this for now as its not working from backend
      cy.clickOnLogo();
      cy.get('[id*="tab-tasks"]').click();
      cy.get('[data-testid="task-feed-card"]')
        .contains(testCaseName)
        .scrollIntoView()
        .should('be.visible');
    });

    it("Re-assign incident from test case page's header", () => {
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/name/*?fields=*',
        'getTestCase'
      );
      interceptURL('GET', '/api/v1/feed?entityLink=*&type=Task', 'getTaskFeed');
      cy.sidebarClick(SidebarItem.INCIDENT_MANAGER);
      cy.get(`[data-testid="test-case-${testCaseName}"]`).click();
      verifyResponseStatusCode('@getTestCase', 200);
      interceptURL('GET', '/api/v1/users?*', 'getUsers');
      cy.get('[data-testid="assignee"] [data-testid="edit-owner"]').click();
      verifyResponseStatusCode('@getUsers', 200);
      cy.get('[data-testid="loader"]').should('not.exist');
      interceptURL('GET', `api/v1/search/query?q=*`, 'searchOwner');
      cy.get('[data-testid="owner-select-users-search-bar"]').type(
        userData3.displayName
      );
      verifyResponseStatusCode('@searchOwner', 200);
      cy.get(`.ant-popover [title="${userData3.displayName}"]`).click();
      interceptURL(
        'POST',
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
        'updateTestCaseIncidentStatus'
      );
      cy.get('[data-testid="selectable-list-update-btn"]').click();
      verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
      cy.get('[data-testid="assignee"] [data-testid="owner-link"]').should(
        'contain',
        userData3.displayName
      );
    });

    it('Resolve incident', () => {
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/name/*?fields=*',
        'getTestCase'
      );
      interceptURL('GET', '/api/v1/feed?entityLink=*&type=Task', 'getTaskFeed');
      cy.sidebarClick(SidebarItem.INCIDENT_MANAGER);
      cy.get(`[data-testid="test-case-${testCaseName}"]`).click();
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('[data-testid="incident"]').click();
      verifyResponseStatusCode('@getTaskFeed', 200);
      cy.get('[data-testid="task-cta-buttons"]')
        .contains('Resolve')
        .scrollIntoView()
        .click();
      cy.get('#testCaseFailureReason').click();
      cy.get('[title="Missing Data"]').click();
      cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
        .click()
        .type('test');
      interceptURL(
        'POST',
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
        'updateTestCaseIncidentStatus'
      );
      cy.get('.ant-modal-footer').contains('Submit').click();
      verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
    });
  });

  describe('Resolving incident & re-run pipeline', () => {
    const testName = testCases[1];

    beforeEach(() => {
      cy.login();
    });

    it("Acknowledge table test case's failure", () => {
      acknowledgeTask(testName);
    });

    it('Resolve task from incident list page', () => {
      goToProfilerTab();

      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases?fields=*&entityLink=*&includeAllTests=true&limit=*',
        'testCaseList'
      );
      cy.get('[data-testid="profiler-tab-left-panel"]')
        .contains('Data Quality')
        .click();
      verifyResponseStatusCode('@testCaseList', 200);
      cy.get(`[data-testid="${testName}"]`)
        .find('.last-run-box.failed')
        .scrollIntoView()
        .should('be.visible');
      cy.get('.ant-table-row-level-0').should('contain', 'Ack');
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus?latest=true&startTs=*&endTs=*&limit=*',
        'getIncidentList'
      );
      cy.sidebarClick(SidebarItem.INCIDENT_MANAGER);

      verifyResponseStatusCode('@getIncidentList', 200);

      cy.get(`[data-testid="test-case-${testName}"]`).should('be.visible');
      cy.get(`[data-testid="${testName}-status"]`)
        .find(`[data-testid="edit-resolution-icon"]`)
        .click();
      cy.get(`[data-testid="test-case-resolution-status-type"]`).click();
      cy.get(`[title="Resolved"]`).click();
      cy.get('#testCaseResolutionStatusDetails_testCaseFailureReason').click();
      cy.get('[title="Missing Data"]').click();
      cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
        .click()
        .type('test');
      interceptURL(
        'POST',
        '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
        'updateTestCaseIncidentStatus'
      );
      cy.get('.ant-modal-footer').contains('Submit').click();
      verifyResponseStatusCode('@updateTestCaseIncidentStatus', 200);
    });

    it('Task should be closed', () => {
      goToProfilerTab();
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/name/*?fields=*',
        'getTestCase'
      );
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases?fields=*&entityLink=*&includeAllTests=true&limit=*',
        'testCaseList'
      );
      interceptURL('GET', '/api/v1/feed?entityLink=*&type=Task', 'getTaskFeed');
      cy.get('[data-testid="profiler-tab-left-panel"]')
        .contains('Data Quality')
        .click();
      verifyResponseStatusCode('@testCaseList', 200);
      cy.get(`[data-testid="${testName}"]`)
        .find('.last-run-box.failed')
        .scrollIntoView()
        .should('be.visible');

      cy.get(`[data-testid="${testName}"]`).contains(testName).click();
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('[data-testid="incident"]').click();
      verifyResponseStatusCode('@getTaskFeed', 200);
      cy.get('[data-testid="closed-task"]').click();
      cy.get('[data-testid="task-feed-card"]').should('be.visible');
      cy.get('[data-testid="task-tab"]').should(
        'contain',
        'Resolved the Task.'
      );
    });

    it('Re-run pipeline', () => {
      triggerTestCasePipeline({
        serviceName: DATABASE_SERVICE.service.name,
        tableName: TABLE_NAME,
      });
    });

    it('Verify open and closed task', () => {
      acknowledgeTask(testName);
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/name/*?fields=*',
        'getTestCase'
      );
      interceptURL('GET', '/api/v1/feed?entityLink=*&type=Task', 'getTaskFeed');
      cy.reload();
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('[data-testid="incident"]').click();
      verifyResponseStatusCode('@getTaskFeed', 200);
      cy.get('[data-testid="open-task"]')
        .invoke('text')
        .then((text) => {
          expect(text.trim()).equal('1 Open');
        });
      cy.get('[data-testid="closed-task"]')
        .invoke('text')
        .then((text) => {
          expect(text.trim()).equal('1 Closed');
        });
    });
  });

  describe('Rerunning pipeline for an open incident', () => {
    const testName = testCases[2];

    beforeEach(() => {
      cy.login();
    });

    it('Ack incident and verify open task', () => {
      acknowledgeTask(testName);
      interceptURL(
        'GET',
        '/api/v1/dataQuality/testCases/name/*?fields=*',
        'getTestCase'
      );
      interceptURL('GET', '/api/v1/feed?entityLink=*&type=Task', 'getTaskFeed');
      cy.reload();
      verifyResponseStatusCode('@getTestCase', 200);
      cy.get('[data-testid="incident"]').click();
      verifyResponseStatusCode('@getTaskFeed', 200);
      cy.get('[data-testid="open-task"]')
        .invoke('text')
        .then((text) => {
          expect(text.trim()).equal('1 Open');
        });
    });

    it('Assign incident to user', () => {
      assignIncident(testName);
    });

    it('Re-run pipeline', () => {
      triggerTestCasePipeline({
        serviceName: DATABASE_SERVICE.service.name,
        tableName: TABLE_NAME,
      });
    });

    it("Verify incident's status on DQ page", () => {
      goToProfilerTab();

      cy.get('[data-testid="profiler-tab-left-panel"]')
        .contains('Data Quality')
        .click();
      cy.get(`[data-testid="${testName}"]`)
        .find('.last-run-box.failed')
        .scrollIntoView()
        .should('be.visible');
      cy.get(`[data-testid="${testName}-status"]`).should(
        'contain',
        'Assigned'
      );
    });
  });
});
