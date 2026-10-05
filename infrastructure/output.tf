# Outputs

output "iam_users" {
  description = "IAM user => permission profile"
  value       = var.iam_users
}

output "cloudfront_domain_name" {
  description = "Public URL of the distribution"
  value       = "https://${aws_cloudfront_distribution.this.domain_name}"
}

output "api_url" {
  description = "API endpoint through CloudFront"
  value       = "https://${aws_cloudfront_distribution.this.domain_name}/api/"
}

output "s3_bucket_name" {
  value = aws_s3_bucket.site.id
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.items.name
}

output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}

output "sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}