variable "region" {
  description = "AWS region for regional resources"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Capstone Project Name"
  type        = string
  default     = "capstone-app"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "alert_email" {
  description = "Email address that receives SNS alarm notifications"
  type        = string
  default     = "kafibanjo@gmail.com"
}

variable "lambda_memory_mb" {
  type    = number
  default = 256
}

variable "lambda_timeout_s" {
  type    = number
  default = 10
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "iam_users" {
  description = "Map of IAM user name => permission profile"
  type        = map(string)
  default = {
    Eedriz1 = "deployer"
    Edim1   = "api_debugger"
    Joy1    = "data_reader"
    Emma1   = "monitor"
  }

  validation {
    condition     = alltrue([for p in values(var.iam_users) : contains(["deployer", "api_debugger", "data_reader", "monitor"], p)])
    error_message = "Profile must be one of: deployer, api_debugger, data_reader, monitor."
  }
}