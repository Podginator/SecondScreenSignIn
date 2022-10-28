import { AWSError, DynamoDB } from "aws-sdk";
import axios from 'axios';
import { aws4Interceptor } from 'aws4-axios';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: "websocketInteractions"})

const interceptor = aws4Interceptor({
    region: process.env.AWS_REGION!!,
    service: "execute-api"
});
axios.interceptors.request.use(interceptor);

export type ClientLoginCodeMap = { 
    loginCode: string, 
    clientId: string
};

const documentClient = new DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

// Iterates from A (65) to Z(90)
const ACCEPTABLE_KEYS = [...Array(25).keys()].map((idx) => String.fromCharCode(65 + idx))


export function getKeyForConnectionId(connectionId: string): Promise<string> { 
    return documentClient.query({ 
        TableName: process.env.TABLE_NAME!!, 
        IndexName: "connectionIdIdx",
        KeyConditionExpression: 'connectionId = :connectionId',
        ExpressionAttributeValues: {
          ':connectionId': connectionId
        }
      })
      .promise()
      .then(({Items}) => { 
          if (Items?.length == 0) { 
              logger.error(`Could not find LoginCode for connectionId: ${connectionId}`);
              throw new Error("Could not find LoginCode");
          }

          const loginCodeMap = Items![0] as ClientLoginCodeMap;
          logger.info(`Returned ${loginCodeMap.loginCode} for ${loginCodeMap.clientId}`);
          return loginCodeMap.loginCode
      });
}

function generateRandomCode(): string { 
  return [...Array(4).keys()]
    .map(
      (_) =>
      ACCEPTABLE_KEYS[
          Math.floor(Math.random() * (ACCEPTABLE_KEYS.length))
        ]
    )
    .join("");
}

export function addRandomCodeForUser(connectionId: string) : Promise<string> { 
    const ttl = Math.floor((new Date()).getTime() / 1000) + 3600;
    const loginCode = generateRandomCode(); 

    const putParameters = {
        TableName: process.env.TABLE_NAME!!,
        Item: {
          connectionId, 
          ttl,
          loginCode  
        }
      };

    logger.info(`Generated code for ${connectionId}: ${loginCode}`);

    return documentClient.put(putParameters)
      .promise()
      .then((_) => loginCode)
      .catch((err: AWSError) => { 
          if (err.name === "ConditionalCheckFailedException") { 
              logger.warn(`Code already used, trying to generate new code`);
              return addRandomCodeForUser(connectionId);
          }

          else throw err;
      })
}

export function sendLoginCodeBackToClient(connectionId: string, loginCode: string) : Promise<string> {
  logger.info(`Returning code for ${connectionId}: ${loginCode}`);

  return axios.post(`${process.env.WEBSOCKET_URI}/@connections/${connectionId}`, { loginCode })
    .then(_ => loginCode)
    .catch(err => { 
      logger.error("Error thrown when calling websocket", err);
      throw err; 
    })
} 