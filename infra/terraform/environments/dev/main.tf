module "evidence_bucket" {
  source = "../../modules/s3-evidence"

  bucket_name = "hometrust-evidence-dev"

  tags = {
    Project     = "HomeTrust"
    Environment = "dev"
    Component   = "evidence-storage"
  }
}

module "presigned_upload" {
  source = "../../modules/lambda-presigned-upload"

  function_name = "hometrust-presigned-upload"

  bucket_name = module.evidence_bucket.bucket_name
  bucket_arn  = module.evidence_bucket.bucket_arn
}

module "presigned_upload_api" {
  source = "../../modules/http-api-lambda"

  api_name      = "hometrust-presigned-upload-api"
  function_name = module.presigned_upload.function_name
  function_arn  = module.presigned_upload.function_arn

  route_key       = "POST /presigned-upload"
  allowed_origins = ["*"] # replace with your frontend URL when you have one
  auth_type       = "NONE"

  tags = {
    Project     = "HomeTrust"
    Environment = "dev"
    Component   = "evidence-api"
  }
}
