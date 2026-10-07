variable "function_name" {
  description = "Name of the presigned upload Lambda function"
  type        = string
}

variable "bucket_arn" {
  description = "ARN of the S3 evidence bucket"
  type        = string
}

variable "bucket_name" {
  description = "Name of the S3 evidence bucket"
  type        = string
}
