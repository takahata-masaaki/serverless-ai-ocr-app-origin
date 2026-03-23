import os
class Settings:
    BUCKET_NAME = os.getenv('DOC_BUCKET_NAME')
    AZURE_VISION_KEY = os.getenv('AZURE_VISION_KEY')
    AZURE_VISION_ENDPOINT = os.getenv('AZURE_VISION_ENDPOINT')
    YOMITOKU_EC2_URL = os.getenv('YOMITOKU_EC2_URL')
    OCR_ENGINE = os.getenv('OCR_ENGINE', 'azure')
settings = Settings()
