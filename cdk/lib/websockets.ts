import { Duration } from "aws-cdk-lib";
import {
  LambdaRestApi,
  CfnAuthorizer,
  LambdaIntegration,
  AuthorizationType,
  DomainName,
} from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { UserPool } from "aws-cdk-lib/aws-cognito";
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
  constructor(scope: Construct, id: string, userPool: UserPool, table: Table, tableName: string) {
    super(scope, id);

    const sendAuthFunction = new Function(this, "sendAuthToWebsocketFunction", {
      code: new AssetCode("../api/sendauth"),
      handler: "index.handler",
      runtime: Runtime.NODEJS_16_X,
      environment: {
        TABLE_NAME: tableName,
        WEBSOCKET_URI: `https://${process.env.WS_DOMAIN}`
      },
    });
    table.grantReadWriteData(sendAuthFunction);

    // Rest API backed by the helloWorldFunction
    const sendAuthRestApi = new LambdaRestApi(this, "sendAuthToWebsocketRestApi", {
      restApiName: "Second Screen Sign On",
      handler: sendAuthFunction,
      proxy: false,
      defaultCorsPreflightOptions: {
        allowHeaders: [
          '*',
        ],
        allowMethods: ['*'],
        allowCredentials: true,
        allowOrigins: ['*'],
      },
      domainName: {
        domainName: process.env.API_DOMAIN!!,
        certificate: Certificate.fromCertificateArn(
          this,
          "ACM_Certificate_API",
          process.env.CERT_ARN!!
        ),
      },
    });

    // We want to ensure that the only person who can send a websocket message to the original 
    // is the user who was authorized to do so. 
    const authorizer = new CfnAuthorizer(this, "sendAuthToWebsocketAuthorizer", {
      restApiId: sendAuthRestApi.restApiId,
      name: "AuthToWSAuthorizer",
      type: "COGNITO_USER_POOLS",
      identitySource: "method.request.header.Authorization",
      providerArns: [userPool.userPoolArn],
    });

    const sendAuth = sendAuthRestApi.root.addResource("send");

    sendAuth.addMethod("POST", new LambdaIntegration(sendAuthFunction), {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: {
        authorizerId: authorizer.ref,
      },
    });

    // initialise api
    const name = "websocketApi";
    const api = new CfnApi(this, name, {
      name: "ChatAppApi",
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

    const connectFunc = new Function(this, "websocketOnConnectLambda", {
      code: new AssetCode("../websockets"),
      handler: "index.onConnectHandler",
      runtime: Runtime.NODEJS_16_X,
      timeout: Duration.seconds(300),
      memorySize: 256,
      environment: {
        TABLE_NAME: tableName!!,
        WEBSOCKET_URI: `https://${process.env.WS_DOMAIN}`
      },
    });

    const onMessage = new Function(this, "webSocketRequestLoginCode", {
      code: new AssetCode("../websockets"),
      handler: "index.onRequestCode",
      runtime: Runtime.NODEJS_12_X,
      timeout: Duration.seconds(300),
      memorySize: 256,
      environment: {
        TABLE_NAME: tableName!!,
        WEBSOCKET_URI: `https://${process.env.WS_DOMAIN}`
      },
    });

    table.grantReadWriteData(connectFunc);
    table.grantReadWriteData(onMessage);

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

    connectFunc.role?.attachInlinePolicy(
      new Policy(this, "executeConnectPolicy", {
        statements: [execApiPolicy],
      })
    );

    sendAuthFunction.role?.attachInlinePolicy(
      new Policy(this, "executeSendAuthPolicy", {
        statements: [execApiPolicy],
      })
    );

    // access role for the socket api to access the socket lambda
    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [connectFunc.functionArn, onMessage.functionArn],
      actions: ["lambda:InvokeFunction"],
    });

    const role = new Role(this, `${name}IamRole`, {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });
    role.addToPolicy(policy);

    // lambda integration
    const connectIntegration = new CfnIntegration(
      this,
      "onConnectLambdaIntegration",
      {
        apiId: api.ref,
        integrationType: "AWS_PROXY",
        integrationUri:
          "arn:aws:apigateway:" +
          process.env.CDK_REGION +
          ":lambda:path/2015-03-31/functions/" +
          connectFunc.functionArn +
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

    const connectRoute = new CfnRoute(this, "websocketOnConnectRoute", {
      apiId: api.ref,
      routeKey: "$connect",
      authorizationType: "NONE",
      target: "integrations/" + connectIntegration.ref,
    });

    const onCodeRoute = new CfnRoute(this, "websocketRequestLoginCodeRoute", {
      apiId: api.ref,
      routeKey: "loginCode",
      authorizationType: "NONE",
      target: "integrations/" + loginCodeIntegration.ref,
    });

    deployment.node.addDependency(connectRoute);
    deployment.node.addDependency(onCodeRoute);

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

    new ARecord(this, "apiGatewayRecordSetRestApi", {
      recordName: "api",
      zone: hostedZone,
      target: RecordTarget.fromAlias(
        new ApiGateway(sendAuthRestApi)
      ),
    });
  }
}
