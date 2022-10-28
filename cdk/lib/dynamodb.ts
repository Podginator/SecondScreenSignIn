import { AttributeType, Table, ProjectionType } from "aws-cdk-lib/aws-dynamodb";
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from "constructs";

export class DynamoDBTable extends Construct {

    table: Table;
    tableName: string;  

    constructor(scope: Construct, id: string) {
        super(scope, id);

        const tableName = "connectionLoginCodes";

        const table = new Table(scope, `${tableName}Table`, {
            tableName: tableName,
            partitionKey: {
                name: "loginCode",
                type: AttributeType.STRING,
            },
            readCapacity: 5,
            writeCapacity: 5,
            removalPolicy: RemovalPolicy.DESTROY,
            timeToLiveAttribute: 'ttl'
        });

        table.addGlobalSecondaryIndex({
            indexName: "connectionIdIdx",
            partitionKey: {
                name: "connectionId",
                type: AttributeType.STRING
            },
            readCapacity: 5,
            writeCapacity: 5,
            projectionType: ProjectionType.ALL
        })

        this.table = table;
        this.tableName = tableName;
    }
    
}