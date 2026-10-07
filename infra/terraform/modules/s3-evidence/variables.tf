variable "bucket_name" {
  description = "Name of the S3 evidence bucket"
  type        = string
}

variable "tags" {
  description = "Tags applied to the S3 bucket"
  type        = map(string)
  default     = {}
}
