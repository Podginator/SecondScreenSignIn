import { APIGatewayEvent, APIGatewayProxyResultV2, APIGatewayEventRequestContext } from "aws-lambda";
import { AWSError, DynamoDB } from "aws-sdk";
import axios from 'axios';
import { aws4Interceptor } from 'aws4-axios';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'sendAuthToWebsocket' });

type WebsocketAuthEvent = { 
  inputCode: string, 
  accessToken: string, 
  idToken: string
};

const interceptor = aws4Interceptor({
    region: process.env.AWS_REGION!!,
    service: "execute-api"
});
axios.interceptors.request.use(interceptor);

const documentClient = new DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

function retrieveConnectedWebsocketFromLoginCode(loginCode: string): Promise<string> { 
  const getRequest = { 
    TableName: process.env.TABLE_NAME!!, 
    KeyConditionExpression: 'loginCode = :loginCode',
    ExpressionAttributeValues: {
      ':loginCode': loginCode
    }
  };

  logger.info('Retrieving connection Id from DynamoDB');
  
  return documentClient.query(getRequest)
    .promise() 
    .then(({ Items }) => { 
      if (Items?.length === 0) { 
        throw new Error("Connection Id Not Found");
      }

      const connectionId = Items!![0].connectionId as string;
      logger.info(`Retrieved connection Id: ${connectionId}`);

      return Items!![0].connectionId as string;
    })
    .catch((err: AWSError) => { 
      logger.error(`Error Retrieving Connection Id`, err);
      if (err.name == "ConditionalCheckFailedException") { 
        throw new Error("Connection Id Not Found");
      }

      throw err; 
    })
}

// TODO: This
async function verifyToken(authToken: string): Promise<boolean> { 
  logger.info('verifying token');
  return Promise.resolve(true);
}

export async function handler(event: APIGatewayEvent, _: APIGatewayEventRequestContext): Promise<APIGatewayProxyResultV2> { 
    const wsEvent = JSON.parse(event.body!!) as WebsocketAuthEvent;
    logger.info(`Received Event for ${wsEvent.inputCode}`);

    try { 
      const connectionId = await retrieveConnectedWebsocketFromLoginCode(wsEvent.inputCode);
      const verifiedToken = await verifyToken(wsEvent.accessToken); 

      if (!verifiedToken) { 
        logger.warn(`Unable to validate token, returning an unauthenticated error`);
        return { statusCode: 401, body: JSON.stringify({ error: "Unable to validate token" })};
      }

      logger.info(`sending Auth Tokens to ${connectionId} for ${wsEvent.inputCode}`);
      return await axios.post(`${process.env.WEBSOCKET_URI}/@connections/${connectionId}`, wsEvent)
        .then(_ => ({ statusCode: 200 }));
    } catch (error: any) { 
      logger.error(`Unable to send to client`, error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message })};
    }
}