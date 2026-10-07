output "bucket_name" {
  description = "Name of the evidence bucket"
  value       = aws_s3_bucket.evidence.bucket
}

output "bucket_arn" {
  description = "ARN of the evidence bucket"
  value       = aws_s3_bucket.evidence.arn
}
