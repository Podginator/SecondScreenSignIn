import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2, APIGatewayEventRequestContext } from "aws-lambda";
import { addRandomCodeForUser, getKeyForConnectionId, sendLoginCodeBackToClient, deleteConnection } from "./lib/code";
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: "websocketInteractions" })

export function onConnectHandler(event: APIGatewayProxyWebsocketEventV2, _: APIGatewayEventRequestContext): Promise<APIGatewayProxyResultV2> {
    const connectionId = event.requestContext.connectionId;
    logger.info(`Retrieved request for ${connectionId}`);

    return addRandomCodeForUser(connectionId)
        .then(loginCode => ({
            statusCode: 200,
            body: JSON.stringify({ loginCode })
        }))
}

export function onRequestCode(event: APIGatewayProxyWebsocketEventV2, _: APIGatewayEventRequestContext): Promise<APIGatewayProxyResultV2> {
    const connectionId = event.requestContext.connectionId;
    logger.info(`Retrieved request for code from ${connectionId}`);

    return getKeyForConnectionId(connectionId)
        .then(loginMap => sendLoginCodeBackToClient(connectionId, loginMap.loginCode))
        .then(loginCode => ({
            statusCode: 200,
            body: loginCode
        }))
}

export function onDisconnectHandler(event: APIGatewayProxyWebsocketEventV2, _: APIGatewayEventRequestContext): Promise<APIGatewayProxyResultV2> {
    const connectionId = event.requestContext.connectionId;
    logger.info(`Retrieved Disconnect for ${connectionId}`);

    return deleteConnection(connectionId)
        .then(() => ({
            statusCode: 200,
        }));
}
