variable "jwt_secret_arn" {
  description = "ARN of the HomeTrust JWT secret in AWS Secrets Manager"
  type        = string
  sensitive   = true
}
