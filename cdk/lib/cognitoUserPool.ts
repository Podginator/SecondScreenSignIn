import {
  UserPool,
  UserPoolEmail,
  OAuthScope,
  CfnUserPool,
  CfnUserPoolUICustomizationAttachment
} from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import * as fs from 'fs';

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

    new CfnUserPoolUICustomizationAttachment(
      this,
      'UserPoolHostedUICustomisation',
      {
        userPoolId: userPool.userPoolId,
        clientId: 'ALL',
        css: fs.readFileSync('./static/cognito.css').toString('utf-8'),
      }
    );

    userPool.addClient("secondSignOnExampleClient", {
      generateSecret: false,
      oAuth: {
        flows: {
          implicitCodeGrant: true,
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
