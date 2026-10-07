output "evidence_bucket_name" {
  value = module.evidence_bucket.bucket_name
}

output "evidence_bucket_arn" {
  value = module.evidence_bucket.bucket_arn
}

output "presigned_upload_function_name" {
  value = module.presigned_upload.function_name
}

output "presigned_upload_function_arn" {
  value = module.presigned_upload.function_arn
}
