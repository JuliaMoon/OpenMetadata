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
import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { AuthProvider } from '../../generated/configuration/authenticationConfiguration';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import SamlCallback from '../../pages/SamlCallback';
import AccountActivationConfirmation from '../../pages/SignUp/account-activation-confirmation.component';
import { isProtectedRoute } from '../../utils/AuthProvider.util';
import withSuspenseFallback from './withSuspenseFallback';

const SigninPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/LoginPage/SignInPage'))
);

const ForgotPassword = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/ForgotPassword/ForgotPassword.component')
  )
);

const ResetPassword = withSuspenseFallback(
  React.lazy(() => import('../../pages/ResetPassword/ResetPassword.component'))
);

const BasicSignupPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/SignUp/BasicSignup.component'))
);

export const UnAuthenticatedAppRouter = () => {
  const { authConfig, getCallBackComponent, isSigningIn } =
    useApplicationStore();

  const callbackComponent = getCallBackComponent();

  const isBasicAuthProvider =
    authConfig &&
    (authConfig.provider === AuthProvider.Basic ||
      authConfig.provider === AuthProvider.LDAP);

  if (isProtectedRoute(location.pathname)) {
    return <Redirect to={ROUTES.SIGNIN} />;
  }

  return (
    <Switch>
      <Route exact component={SigninPage} path={ROUTES.SIGNIN} />

      {callbackComponent && (
        <Route component={callbackComponent} path={ROUTES.CALLBACK} />
      )}
      <Route
        component={SamlCallback}
        path={[ROUTES.SAML_CALLBACK, ROUTES.AUTH_CALLBACK]}
      />
      {!isSigningIn && (
        <Route path={ROUTES.HOME}>
          <Redirect to={ROUTES.SIGNIN} />
        </Route>
      )}

      {isBasicAuthProvider && (
        <>
          <Route exact component={BasicSignupPage} path={ROUTES.REGISTER} />
          <Route
            exact
            component={ForgotPassword}
            path={ROUTES.FORGOT_PASSWORD}
          />
          <Route exact component={ResetPassword} path={ROUTES.RESET_PASSWORD} />
          <Route
            exact
            component={AccountActivationConfirmation}
            path={ROUTES.ACCOUNT_ACTIVATION}
          />
        </>
      )}
    </Switch>
  );
};
