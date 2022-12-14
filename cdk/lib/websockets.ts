import { Duration } from "aws-cdk-lib";
import {
  DomainName,
} from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { ApiGatewayDomain, ApiGateway } from 'aws-cdk-lib/aws-route53-targets';
import { Policy } from "aws-cdk-lib/aws-iam";
import {
  CfnApi,
  CfnDeployment,
  CfnIntegration,
  CfnRoute,
  CfnStage,
  CfnApiMapping,
} from "aws-cdk-lib/aws-apigatewayv2";
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { AssetCode, Function, Runtime } from "aws-cdk-lib/aws-lambda";

export class WebsocketApi extends Construct {
  constructor(scope: Construct, id: string, table: Table, tableName: string) {
    super(scope, id);

    // initialise api
    const name = "websocketApi";
    const api = new CfnApi(this, name, {
      name: "SingleSocketWebApp",
      protocolType: "WEBSOCKET",
      routeSelectionExpression: "$request.body.action",
    });

    const domain = new DomainName(this, "websocketDomain", {
      domainName: process.env.WS_DOMAIN!!,
      certificate: Certificate.fromCertificateArn(
        this,
        "ACM_Certificate",
        process.env.CERT_ARN!!
      ),
    });

    const onMessage = new Function(this, "webSocketRequestLoginCode", {
      code: new AssetCode("../websockets/dist"),
      handler: "index.onRequestCode",
      runtime: Runtime.NODEJS_16_X,
      timeout: Duration.seconds(300),
      memorySize: 1024,
      environment: {
        TABLE_NAME: tableName!!,
        WEBSOCKET_URI: `https://${process.env.WS_DOMAIN}`
      },
    });

    const disconnectFunc = new Function(this, "websocketOnDisconnectLambda", {
      code: new AssetCode("../websockets/dist"),
      handler: "index.onDisconnectHandler",
      runtime: Runtime.NODEJS_16_X,
      timeout: Duration.seconds(300),
      memorySize: 1024,
      environment: {
        TABLE_NAME: tableName!!,
      },
    });

    table.grantReadWriteData(onMessage);
    table.grantReadWriteData(disconnectFunc);

    const execApiPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["execute-api:*"],
      resources: ["*"], // TODO, fix this.
    });

    onMessage.role?.attachInlinePolicy(
      new Policy(this, "executeOnMessagePolicy", {
        statements: [execApiPolicy],
      })
    );

    // access role for the socket api to access the socket lambda
    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [onMessage.functionArn],
      actions: ["lambda:InvokeFunction"],
    });

    const role = new Role(this, `${name}IamRole`, {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });
    role.addToPolicy(policy);

    // lambda integration
    const disconnectIntegration = new CfnIntegration(
      this,
      "onDisconnectLambdaIntegration",
      {
        apiId: api.ref,
        integrationType: "AWS_PROXY",
        integrationUri:
          "arn:aws:apigateway:" +
          process.env.CDK_REGION +
          ":lambda:path/2015-03-31/functions/" +
          disconnectFunc.functionArn +
          "/invocations",
        credentialsArn: role.roleArn,
      }
    );

    const loginCodeIntegration = new CfnIntegration(
      this,
      "requestLoginCodeIntegration",
      {
        apiId: api.ref,
        integrationType: "AWS_PROXY",
        integrationUri:
          "arn:aws:apigateway:" +
          process.env.CDK_REGION +
          ":lambda:path/2015-03-31/functions/" +
          onMessage.functionArn +
          "/invocations",
        credentialsArn: role.roleArn,
      }
    );

    const deployment = new CfnDeployment(this, `${name}Deployment`, {
      apiId: api.ref,
    });

    const stage = new CfnStage(this, `${name}Stage`, {
      apiId: api.ref,
      autoDeploy: true,
      deploymentId: deployment.ref,
      stageName: "prod",
    });

    const mapping = new CfnApiMapping(this, "websocketMapping", {
      apiId: api.ref,
      domainName: process.env.WS_DOMAIN!!,
      stage: stage.ref,
    });

    const disconnectRoute = new CfnRoute(this, "websocketDisonnectRoute", {
      apiId: api.ref,
      routeKey: "$disconnect",
      authorizationType: "NONE",
      target: "integrations/" + disconnectIntegration.ref,
    });

    const onCodeRoute = new CfnRoute(this, "websocketRequestLoginCodeRoute", {
      apiId: api.ref,
      routeKey: "loginCode",
      authorizationType: "NONE",
      target: "integrations/" + loginCodeIntegration.ref,
    });

    deployment.node.addDependency(onCodeRoute);
    deployment.node.addDependency(disconnectRoute);

    const hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
      domainName: process.env.ZONE_NAME!!,
    });

    new ARecord(this, "apiGatewayRecordSetWebsocket", {
      recordName: "ws",
      zone: hostedZone,
      target: RecordTarget.fromAlias(
        new ApiGatewayDomain(domain)
      ),
    });

  }

}
