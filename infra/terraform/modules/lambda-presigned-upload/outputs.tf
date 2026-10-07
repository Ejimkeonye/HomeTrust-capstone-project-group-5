output "function_name" {
  description = "Name of the presigned upload Lambda function"
  value       = aws_lambda_function.presigned_upload.function_name
}

output "function_arn" {
  description = "ARN of the presigned upload Lambda function"
  value       = aws_lambda_function.presigned_upload.arn
}

output "role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda.arn
}
