import { CognitoIdToken, CognitoUserSession, CognitoUser, CognitoAccessToken, CognitoRefreshToken,  CognitoUserPool } from 'amazon-cognito-identity-js';

const TOKEN_URL = "https://podginatorssso.auth.eu-west-1.amazoncognito.com/oauth2/token"

const userPool = new CognitoUserPool({
    UserPoolId: `eu-west-1_F3Riur46m`,
    ClientId: `35vtfdgo5jolhcpumvof6k9oo8`,
  });

export const setSignedInUserFromTokens = (tokens) => { 
    const cognitoIdToken = new CognitoIdToken({
        IdToken: tokens.idToken,
      });
      const cognitoAccessToken = new CognitoAccessToken({
        AccessToken: tokens.accessToken,
      });
      const cognitoRefreshToken = new CognitoRefreshToken({
        RefreshToken: tokens.refreshToken,
      });
      console.log(cognitoIdToken.payload);
      const username = cognitoIdToken.payload.email; // or what you use as username, e.g. email

      const user = new CognitoUser({
        Username: username,
        Pool: userPool,
      });

      user.setSignInUserSession(new CognitoUserSession({ 
        AccessToken: cognitoAccessToken,
        IdToken: cognitoIdToken,
        RefreshToken: cognitoRefreshToken,
      }));

      return user;
}

export const getCurrentSession = (user) => { 
    return user.getCurrentSession();
}

export const getTokensFromTokenUrl = (code) => {
    return fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        "grant_type": "authorization_code",
        code,
        "client_id": "35vtfdgo5jolhcpumvof6k9oo8",
        "redirect_uri": "https://podginator.com/signedIn"
      })
    })
      .then(it => it.json())
      .then(data => {
        return ({
          "idToken": data["id_token"],
          "accessToken": data["access_token"],
          "refreshToken": data["refresh_token"]
        });
      })
  }