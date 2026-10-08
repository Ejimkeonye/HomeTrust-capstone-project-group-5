variable "api_name" {
  description = "Name of the HTTP API"
  type        = string
}

variable "function_name" {
  description = "Name of the Lambda function to expose"
  type        = string
}

variable "function_arn" {
  description = "ARN of the Lambda function to expose"
  type        = string
}

variable "route_key" {
  description = "HTTP method and path, e.g. \"POST /presigned-upload\""
  type        = string
  default     = "POST /presigned-upload"
}

variable "allowed_origins" {
  description = "Browser origins allowed to call the API (CORS)"
  type        = list(string)
  default     = ["*"]
}

variable "auth_type" {
  description = "NONE = public route, AWS_IAM = SigV4-signed callers only"
  type        = string
  default     = "NONE"

  validation {
    condition     = contains(["NONE", "AWS_IAM"], var.auth_type)
    error_message = "auth_type must be NONE or AWS_IAM."
  }
}

variable "throttle_rate_limit" {
  description = "Steady-state requests per second"
  type        = number
  default     = 25
}

variable "throttle_burst_limit" {
  description = "Burst requests"
  type        = number
  default     = 50
}

variable "tags" {
  type    = map(string)
  default = {}
}