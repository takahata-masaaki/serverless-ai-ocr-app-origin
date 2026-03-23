import boto3
import os
dynamodb = boto3.resource('dynamodb')
jobs_table = dynamodb.Table(os.environ['JOBS_TABLE_NAME'])

def get_image(image_id):
    return jobs_table.get_item(Key={'id': image_id}).get('Item')

def update_image_status(image_id, status):
    jobs_table.update_item(
        Key={'id': image_id},
        UpdateExpression='SET #st = :status',
        ExpressionAttributeNames={'#st': 'status'},
        ExpressionAttributeValues={':status': status}
    )

def update_ocr_result(image_id, result, status):
    update_image_status(image_id, status)
