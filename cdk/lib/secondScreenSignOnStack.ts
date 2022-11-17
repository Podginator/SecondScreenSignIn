import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { CognitoUserPool } from "./cognitoUserPool";
import { DynamoDBTable } from "./dynamodb";
import { WebsiteHosting } from "./website";
import { WebsocketApi } from "./websockets";
import * as dotenv from "dotenv";
import { Api } from "./api";

dotenv.config();

export class SecondScreenSignOnStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: process.env.CDK_ACCOUNT,
        region: process.env.CDK_REGION,
      },
    });

    const ddb = new DynamoDBTable(this, `${id}-ddb`);
    const cognito = new CognitoUserPool(this, `${id}-cognito`);
    new WebsocketApi(
      this,
      `${id}-ws`,
      ddb.table,
      ddb.tableName
    );
    new Api(this, `${id}-restApi`, cognito.userPool, ddb.table, ddb.tableName);
    new WebsiteHosting(this, `${id}-website`);
  }
}
