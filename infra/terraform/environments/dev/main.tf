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
