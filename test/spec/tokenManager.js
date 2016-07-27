define(function(require) {
  var OktaAuth = require('OktaAuth');
  var tokens = require('../util/tokens');
  var util = require('../util/util');
  var oauthUtil = require('../util/oauthUtil');

  function setupSync(options) {
    options = options || {};
    return new OktaAuth({
      url: 'https://auth-js-test.okta.com',
      clientId: 'NPSfOkH5eZrTy8PMDlvx',
      redirectUri: 'https://auth-js-test.okta.com/redirect',
      tokenManager: {
        storage: options.type
      }
    });
  }

  beforeEach(function() {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('TokenManager', function() {
    describe('general', function() {
      it('defaults to localStorage', function() {
        var client = setupSync();
        client.tokenManager.add('test-idToken', tokens.standardIdTokenParsed);
        oauthUtil.expectTokenStorageToEqual(localStorage, {
          'test-idToken': tokens.standardIdTokenParsed
        });
      });
    });

    describe('add', function() {
      it('throws an error when attempting to add a non-token', function() {
        var client = setupSync();
        try {
          client.tokenManager.add('test-idToken', [
            tokens.standardIdTokenParsed,
            tokens.standardIdTokenParsed
          ]);

          // Should never hit this
          expect(true).toEqual(false);
        } catch (e) {
          util.expectErrorToEqual(e, {
            name: 'AuthSdkError',
            message: 'Token must be an Object with scopes, expiresAt, and an idToken or accessToken properties',
            errorCode: 'INTERNAL',
            errorSummary: 'Token must be an Object with scopes, expiresAt, and an idToken or accessToken properties',
            errorLink: 'INTERNAL',
            errorId: 'INTERNAL',
            errorCauses: []
          });
        }
      });
    });

    describe('refresh', function() {
      it('allows refreshing an idToken', function(done) {
        return oauthUtil.setupFrame({
          oktaAuthArgs: {
            url: 'https://auth-js-test.okta.com',
            clientId: 'NPSfOkH5eZrTy8PMDlvx',
            redirectUri: 'https://auth-js-test.okta.com/redirect'
          },
          tokenManagerAddKeys: {
            'test-idToken': {
              idToken: 'testInitialToken',
              claims: {'fake': 'claims'},
              expiresAt: 0,
              scopes: ['openid', 'email']
            }
          },
          tokenManagerRefreshArgs: ['test-idToken'],
          postMessageSrc: {
            baseUri: 'https://auth-js-test.okta.com/oauth2/v1/authorize',
            queryParams: {
              'client_id': 'NPSfOkH5eZrTy8PMDlvx',
              'redirect_uri': 'https://auth-js-test.okta.com/redirect',
              'response_type': 'id_token',
              'response_mode': 'okta_post_message',
              'state': oauthUtil.mockedState,
              'nonce': oauthUtil.mockedNonce,
              'scope': 'openid email',
              'prompt': 'none'
            }
          },
          postMessageResp: {
            'id_token': tokens.standardIdToken,
            state: oauthUtil.mockedState
          },
          expectedResp: tokens.standardIdTokenParsed
        })
        .then(function() {
          oauthUtil.expectTokenStorageToEqual(localStorage, {
            'test-idToken': tokens.standardIdTokenParsed
          });
        })
        .fin(done);
      });

      it('allows refreshing an accessToken', function(done) {
        return oauthUtil.setupFrame({
          oktaAuthArgs: {
            url: 'https://auth-js-test.okta.com',
            clientId: 'NPSfOkH5eZrTy8PMDlvx',
            redirectUri: 'https://auth-js-test.okta.com/redirect'
          },
          tokenManagerAddKeys: {
            'test-accessToken': {
              accessToken: 'testInitialToken',
              expiresAt: 1449703529,
              scopes: ['openid', 'email'],
              tokenType: 'Bearer'
            }
          },
          tokenManagerRefreshArgs: ['test-accessToken'],
          postMessageSrc: {
            baseUri: 'https://auth-js-test.okta.com/oauth2/v1/authorize',
            queryParams: {
              'client_id': 'NPSfOkH5eZrTy8PMDlvx',
              'redirect_uri': 'https://auth-js-test.okta.com/redirect',
              'response_type': 'token',
              'response_mode': 'okta_post_message',
              'state': oauthUtil.mockedState,
              'nonce': oauthUtil.mockedNonce,
              'scope': 'openid email',
              'prompt': 'none'
            }
          },
          postMessageResp: {
            'access_token': tokens.standardAccessToken,
            'token_type': 'Bearer',
            'expires_in': 3600,
            'state': oauthUtil.mockedState
          },
          expectedResp: tokens.standardAccessTokenParsed
        })
        .then(function() {
          oauthUtil.expectTokenStorageToEqual(localStorage, {
            'test-accessToken': tokens.standardAccessTokenParsed
          });
        })
        .fin(done);
      });

      oauthUtil.itpErrorsCorrectly('throws an errors when a token doesn\'t exist',
        {
          oktaAuthArgs: {
            url: 'https://auth-js-test.okta.com',
            clientId: 'NPSfOkH5eZrTy8PMDlvx',
            redirectUri: 'https://auth-js-test.okta.com/redirect'
          },
          tokenManagerRefreshArgs: ['test-accessToken']
        },
        {
          name: 'AuthSdkError',
          message: 'The tokenManager has no token for the key: test-accessToken',
          errorCode: 'INTERNAL',
          errorSummary: 'The tokenManager has no token for the key: test-accessToken',
          errorLink: 'INTERNAL',
          errorId: 'INTERNAL',
          errorCauses: []
        }
      );

      it('throws an errors when the token is mangled', function(done) {
        localStorage.setItem('okta-token-storage', '#unparseableJson#');
        return oauthUtil.setupFrame({
          willFail: true,
          oktaAuthArgs: {
            url: 'https://auth-js-test.okta.com',
            clientId: 'NPSfOkH5eZrTy8PMDlvx',
            redirectUri: 'https://auth-js-test.okta.com/redirect'
          },
          tokenManagerRefreshArgs: ['test-accessToken']
        })
        .then(function() {
          expect(true).toEqual(false);
        })
        .fail(function(err) {
          util.expectErrorToEqual(err, {
            name: 'AuthSdkError',
            message: 'Unable to parse token storage string',
            errorCode: 'INTERNAL',
            errorSummary: 'Unable to parse token storage string',
            errorLink: 'INTERNAL',
            errorId: 'INTERNAL',
            errorCauses: []
          });
        })
        .fin(done);
      });

      oauthUtil.itpErrorsCorrectly('throws an error if there\'s an issue refreshing',
        {
          oktaAuthArgs: {
            url: 'https://auth-js-test.okta.com',
            clientId: 'NPSfOkH5eZrTy8PMDlvx',
            redirectUri: 'https://auth-js-test.okta.com/redirect'
          },
          tokenManagerAddKeys: {
            'test-accessToken': {
              accessToken: 'testInitialToken',
              expiresAt: 1449703529,
              scopes: ['openid', 'email'],
              tokenType: 'Bearer'
            }
          },
          tokenManagerRefreshArgs: ['test-accessToken'],
          postMessageSrc: {
            baseUri: 'https://auth-js-test.okta.com/oauth2/v1/authorize',
            queryParams: {
              'client_id': 'NPSfOkH5eZrTy8PMDlvx',
              'redirect_uri': 'https://auth-js-test.okta.com/redirect',
              'response_type': 'token',
              'response_mode': 'okta_post_message',
              'state': oauthUtil.mockedState,
              'nonce': oauthUtil.mockedNonce,
              'scope': 'openid email',
              'prompt': 'none'
            }
          },
          postMessageResp: {
            'access_token': tokens.standardAccessToken,
            'token_type': 'Bearer',
            'expires_in': 3600,
            'state': 'fakeState'
          }
        },
        {
          name: 'AuthSdkError',
          message: 'OAuth flow response state doesn\'t match request state',
          errorCode: 'INTERNAL',
          errorSummary: 'OAuth flow response state doesn\'t match request state',
          errorLink: 'INTERNAL',
          errorId: 'INTERNAL',
          errorCauses: []
        }
      );

      it('removes token if an OAuthError is thrown while refreshing', function(done) {
        return oauthUtil.setupFrame({
          willFail: true,
          oktaAuthArgs: {
            url: 'https://auth-js-test.okta.com',
            clientId: 'NPSfOkH5eZrTy8PMDlvx',
            redirectUri: 'https://auth-js-test.okta.com/redirect'
          },
          tokenManagerAddKeys: {
            'test-accessToken': tokens.standardAccessTokenParsed,
            'test-idToken': tokens.standardIdTokenParsed
          },
          tokenManagerRefreshArgs: ['test-accessToken'],
          postMessageResp: {
            error: 'sampleErrorCode',
            'error_description': 'something went wrong'
          }
        })
        .fail(function(e) {
          util.expectErrorToEqual(e, {
            name: 'OAuthError',
            message: 'something went wrong',
            errorCode: 'sampleErrorCode',
            errorSummary: 'something went wrong'
          });
          oauthUtil.expectTokenStorageToEqual(localStorage, {
            'test-idToken': tokens.standardIdTokenParsed
          });
        })
        .fin(done);
      });
    });

    describe('autoRefresh', function() {
      beforeEach(function() {
        jasmine.clock().install();
      });

      afterEach(function() {
        jasmine.clock().uninstall();
      });

      xit('automatically refreshes a token', function(done) {
        return oauthUtil.setupFrame({
          autoRefresh: true,
          oktaAuthArgs: {
            url: 'https://auth-js-test.okta.com',
            clientId: 'NPSfOkH5eZrTy8PMDlvx',
            redirectUri: 'https://auth-js-test.okta.com/redirect',
            tokenManager: {
              autoRefresh: true
            }
          },
          tokenManagerAddKeys: {
            'test-idToken': tokens.standardIdTokenParsed
          },
          fastForwardToTime: tokens.standardIdTokenParsed.expiresAt + 1,
          postMessageResp: {
            error: 'sampleErrorCode',
            'error_description': 'something went wrong'
          }
        })
        .then(function() {
          oauthUtil.expectTokenStorageToEqual(localStorage, {});
        })
        .fin(done);
      });

      xit('removes a token on OAuth failure', function(done) {
        return oauthUtil.setupFrame({
          autoRefresh: true,
          oktaAuthArgs: {
            url: 'https://auth-js-test.okta.com',
            clientId: 'NPSfOkH5eZrTy8PMDlvx',
            redirectUri: 'https://auth-js-test.okta.com/redirect',
            tokenManager: {
              autoRefresh: true
            }
          },
          tokenManagerAddKeys: {
            'test-idToken': tokens.standardIdTokenParsed
          },
          fastForwardToTime: tokens.standardIdTokenParsed.expiresAt + 1,
          postMessageResp: {
            error: 'sampleErrorCode',
            'error_description': 'something went wrong'
          }
        })
        .then(function() {
          oauthUtil.expectTokenStorageToEqual(localStorage, {});
        })
        .fin(done);
      });
    });

    describe('localStorage', function() {

      function localStorageSetup() {
        return setupSync({
          type: 'localStorage'
        });
      }

      describe('add', function() {
        it('adds a token', function() {
          var client = localStorageSetup();
          client.tokenManager.add('test-idToken', tokens.standardIdTokenParsed);
          oauthUtil.expectTokenStorageToEqual(localStorage, {
            'test-idToken': tokens.standardIdTokenParsed
          });
        });
      });

      describe('get', function() {
        it('gets a token', function() {
          var client = localStorageSetup();
          localStorage.setItem('okta-token-storage', JSON.stringify({
            'test-idToken': tokens.standardIdTokenParsed
          }));
          var result = client.tokenManager.get('test-idToken');
          expect(result).toEqual(tokens.standardIdTokenParsed);
        });
      });

      describe('remove', function() {
        it('removes a token', function() {
          var client = localStorageSetup();
          localStorage.setItem('okta-token-storage', JSON.stringify({
            'test-idToken': tokens.standardIdTokenParsed,
            anotherKey: tokens.standardIdTokenParsed
          }));
          client.tokenManager.remove('test-idToken');
          oauthUtil.expectTokenStorageToEqual(localStorage, {
            anotherKey: tokens.standardIdTokenParsed
          });
        });
      });
    });

    describe('sessionStorage', function() {

      function sessionStorageSetup() {
        return setupSync({
          type: 'sessionStorage'
        });
      }

      describe('add', function() {
        it('adds a token', function() {
          var client = sessionStorageSetup();
          client.tokenManager.add('test-idToken', tokens.standardIdTokenParsed);
          oauthUtil.expectTokenStorageToEqual(sessionStorage, {
            'test-idToken': tokens.standardIdTokenParsed
          });
        });
      });

      describe('get', function() {
        it('gets a token', function() {
          var client = sessionStorageSetup();
          sessionStorage.setItem('okta-token-storage', JSON.stringify({
            'test-idToken': tokens.standardIdTokenParsed
          }));
          var result = client.tokenManager.get('test-idToken');
          expect(result).toEqual(tokens.standardIdTokenParsed);
        });
      });

      describe('remove', function() {
        it('removes a token', function() {
          var client = sessionStorageSetup();
          sessionStorage.setItem('okta-token-storage', JSON.stringify({
            'test-idToken': tokens.standardIdTokenParsed,
            anotherKey: tokens.standardIdTokenParsed
          }));
          client.tokenManager.remove('test-idToken');
          oauthUtil.expectTokenStorageToEqual(sessionStorage, {
            anotherKey: tokens.standardIdTokenParsed
          });
        });
      });
    });


    describe('cookie', function() {

      function cookieStorageSetup() {
        return setupSync({
          type: 'cookie'
        });
      }

      describe('add', function() {
        it('adds a token', function() {
          var client = cookieStorageSetup();
          util.mockGetCookie('');
          var setCookieMock = util.mockSetCookie();
          client.tokenManager.add('test-idToken', tokens.standardIdTokenParsed);
          expect(setCookieMock).toHaveBeenCalledWith('okta-token-storage=' + JSON.stringify({
            'test-idToken': tokens.standardIdTokenParsed
          }) + '; expires=Tue, 19 Jan 2038 03:14:07 GMT;');
        });
      });

      describe('get', function() {
        it('gets a token', function() {
          var client = cookieStorageSetup();
          util.mockGetCookie('okta-token-storage=' + JSON.stringify({
            'test-idToken': tokens.standardIdTokenParsed
          }) + ';');
          var result = client.tokenManager.get('test-idToken');
          expect(result).toEqual(tokens.standardIdTokenParsed);
        });
      });

      describe('remove', function() {
        it('removes a token', function() {
          var client = cookieStorageSetup();
          util.mockGetCookie('okta-token-storage=' + JSON.stringify({
            'test-idToken': tokens.standardIdTokenParsed,
            anotherKey: tokens.standardIdTokenParsed
          }) + ';');
          var setCookieMock = util.mockSetCookie();
          client.tokenManager.remove('test-idToken');
          expect(setCookieMock).toHaveBeenCalledWith('okta-token-storage=' + JSON.stringify({
            anotherKey: tokens.standardIdTokenParsed
          }) + '; expires=Tue, 19 Jan 2038 03:14:07 GMT;');
        });
      });
    });
  });
});
