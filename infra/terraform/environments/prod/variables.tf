variable "environment" {
  type = string
}

variable "cors_allowed_origins" {
  type    = list(string)
  default = ["*"]
}

variable "api_auth_type" {
  type    = string
  default = "NONE"
}