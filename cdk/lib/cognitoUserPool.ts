import {
  UserPool,
  UserPoolEmail,
  OAuthScope,
  CfnUserPool,
} from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export class CognitoUserPool extends Construct {
  userPool: UserPool;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const userPool = new UserPool(this, "secondScreenExampleUserPool", {
      signInAliases: {
        email: true,
        username: false,
        phone: false,
      },
      selfSignUpEnabled: true,
      accountRecovery: 2,
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        familyName: {
          required: true,
          mutable: true,
        },
        phoneNumber: {
          required: false,
          mutable: false,
        },
        givenName: {
          required: true,
          mutable: true,
        },
      },

      email: UserPoolEmail.withCognito(process.env.EMAIL),
    });

    userPool.addClient("secondSignOnExampleClient", {
      generateSecret: false,
      oAuth: {
        flows: {
          implicitCodeGrant: true,
          authorizationCodeGrant: true,
        },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: JSON.parse(process.env.CALLBACKS!!),
      },
    });

    userPool.addDomain("secondScreenDomain", {
      cognitoDomain: {
        domainPrefix: process.env.PREFIX!!,
      },
    });


    const cfnUserPool = userPool.node.defaultChild as CfnUserPool;
    cfnUserPool.emailConfiguration = {
      emailSendingAccount: "DEVELOPER",
      replyToEmailAddress: process.env.EMAIL,
      sourceArn: process.env.EMAIL_ARN,
    };

    this.userPool = userPool;
  }
}
